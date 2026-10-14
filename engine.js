import { world } from './worldData.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const USER_IDS = { root: 0, 'www-data': 33, elliot: 1000, backup: 1001, deploy: 1002 };
const ID_USERS = Object.fromEntries(Object.entries(USER_IDS).map(([name, id]) => [id, name]));
const modeOf = file => typeof file?.mode === 'number' ? file.mode : Number.parseInt(String(file?.mode ?? '0'), 8) || 0;
const numericId = (value, fallback = 0) => Number.isInteger(value) ? value : (USER_IDS[value] ?? fallback);
const tokenize = input => {
  const result = []; let token = ''; let quote = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote) { if (c === quote) quote = null; else if (c === '\\' && quote === '"' && i + 1 < input.length) token += input[++i]; else token += c; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '\\' && i + 1 < input.length) { token += input[++i]; continue; }
    if (c === '|' || c === '>' || c === ';' || c === '&') { if (token) result.push(token); token = ''; if (c === '>' && input[i + 1] === '>') result.push(input[++i] + c); else if (c === '&' && input[i + 1] === '&') { i++; result.push(';'); } else result.push(c); continue; }
    if (/\s/.test(c)) { if (token) result.push(token); token = ''; } else token += c;
  }
  if (quote) throw new Error('Unclosed quote.');
  if (token) result.push(token);
  return result;
};

export class Engine {
  constructor() {
    this.world = structuredClone(world);
    this.state = {
      sessions: [{ user: 'elliot', uid: 1000, gid: 1000, euid: 1000, egid: 1000, groups: [1000, 27], host: 'kali', cwd: '/home/elliot', target: null }],
      actions: [], scanned: {}, discovered: {}, credentials: {}, inspected: [], routes: ['192.168.1.0/24'], mission2Exploit: false, mission2Root: false, complete: [], history: []
    };
  }
  get session() { return this.state.sessions.at(-1); }
  get target() { return this.world.network[this.session.target]; }
  get activeMission() { return this.world.missions.find(m => m.target === this.session.target && !this.state.complete.includes(m.id)) || this.world.missions.find(m => !this.state.complete.includes(m.id)) || this.world.missions.at(-1); }
  get files() { return this.session.target ? this.target?.filesystem || {} : this.world.local.files; }
  get effectiveUser() { return ID_USERS[this.session.euid] || this.session.user; }
  prompt() { const user = this.effectiveUser; return `${user}@${this.session.host}:${this.session.cwd}${this.session.euid === 0 ? '#' : '$'} `; }
  mark(key) { if (!this.state.actions.includes(key)) this.state.actions.push(key); }
  has(key) { return this.state.actions.includes(key); }
  help() { return `Shell: pwd, whoami, id, ls [-la|-l|-a], cd, cat, echo, grep, find [-name|-perm -4000], chmod, sudo -l, su, history, exit\nTools: nmap, curl, searchsploit, exploit, john, ssh, ip\nAcademy: explain <cmd>, mentor, man <tool>, learn <topic>, missions, briefing, irc\nPipes and redirection: command | grep <term>, echo "text" > file, echo "text" >> file\nGame state: save, load. Paths support /, ., .., and ~. All tool actions stay inside the simulated lab.`; }
  async run(input) {
    const result = await this.runCommand(input);
    if (!input.trim()) return result;
    const feedback = this.proactiveFeedback(input, result);
    // Terminate command output before the academy block so readline never
    // redraws the next prompt on the same line as the previous response.
    return [result?.trimEnd(), feedback].filter(Boolean).join('\n\n');
  }
  async runCommand(input) {
    if (!input.trim()) return '';
    try {
      const tokens = tokenize(input.replace(/\s*2>\s*\/dev\/null/g, ''));
      if (!tokens.length) return '';
      this.state.history.push(input);
      if (this.state.history.length > 500) this.state.history.shift();
      let output = '';
      for (const statement of this.split(tokens, ';')) {
        if (!statement.length) continue;
        const redirIndex = statement.findIndex(x => x === '>' || x === '>>');
        let redirect = null;
        if (redirIndex >= 0) {
          if (!statement[redirIndex + 1] || redirIndex + 2 < statement.length) return 'sh: malformed redirection';
          redirect = { mode: statement[redirIndex], path: statement[redirIndex + 1] };
          statement.splice(redirIndex);
        }
        const parts = this.split(statement, '|');
        if (parts.some(part => !part.length)) return 'sh: syntax error near unexpected token `|`';
        let stream = '';
        for (let i = 0; i < parts.length; i++) {
          const words = parts[i];
          if (i > 0 && words[0] === 'grep') {
            const pattern = words.at(-1) || '';
            stream = stream.split('\n').filter(line => line.includes(pattern)).join('\n');
            continue;
          }
          stream = await this.dispatch(words[0], words.slice(1));
        }
        if (redirect) {
          const result = this.redirect(stream, redirect.path, redirect.mode === '>>');
          if (result) output += `${result}\n`;
        } else if (stream) output += `${stream}\n`;
      }
      return output.trimEnd();
    } catch (error) { return `error: ${error.message}`; }
  }
  split(tokens, delimiter) { const result = [[]]; for (const token of tokens) token === delimiter ? result.push([]) : result.at(-1).push(token); return result; }
  async dispatch(command, args) {
    if (!command) return '';
    if (command === 'clear' || command === 'cls') { process.stdout.write('\x1b[2J\x1b[H'); return ''; }
    if (command === 'mentor') return this.mentor();
    if (command === 'missions') return this.missions();
    if (command === 'man') return this.man(args[0]);
    if (command === 'learn') return this.learn(args.join(' '));
    if (command === 'briefing') return this.briefing();
    if (command === 'irc') return this.irc();
    if (command === 'explain') return this.explain(args);
    if (command === 'exit') return this.exit();
    if (command === 'pwd') return this.session.cwd;
    if (command === 'whoami') return this.effectiveUser;
    if (command === 'id') return this.id();
    if (command === 'history') return this.state.history.map((line, i) => `${String(i + 1).padStart(4)}  ${line}`).join('\n');
    if (command === 'help') return this.help();
    if (command === 'ls') return this.ls(args);
    if (command === 'cd') return this.cd(args[0]);
    if (command === 'cat') return this.cat(args);
    if (command === 'echo') return args.join(' ');
    if (command === 'grep') return this.grep(args);
    if (command === 'find') return this.find(args);
    if (command === 'chmod') return this.chmod(args);
    if (command === 'sudo') return this.sudo(args);
    if (command === 'su') return this.su(args);
    if (command === 'nmap') return this.nmap(args);
    if (command === 'curl') return this.curl(args);
    if (command === 'searchsploit') return this.searchsploit(args.join(' '));
    if (command === 'exploit') return this.exploit(args);
    if (command === 'john') return this.john(args);
    if (command === 'ssh') return this.ssh(args);
    if (command === 'ip') return this.ip();
    if (command === 'save') return this.save();
    if (command === 'load') return this.load();
    if (command.startsWith('./') || command.startsWith('/')) return this.execute(command);
    return `${command}: command not found (type help)`;
  }
  stepIndex() {
    const m = this.activeMission;
    if (m.id === 'mission1') return !this.has('m1-scan') ? 0 : !this.has('m1-config') ? 1 : !this.has('m1-john') ? 2 : !this.has('m1-ssh') ? 3 : !this.has('m2-find') ? 4 : !this.has('m2-inspect') ? 5 : !this.has('m2-script') ? 6 : 7;
    if (m.id === 'mission2') return !this.has('m2-scan') ? 0 : !this.has('m2-search') ? 1 : !this.state.mission2Exploit ? 2 : !this.has('m2-sudo') ? 3 : !this.state.mission2Root ? 4 : 5;
    return !this.has('m3-route') ? 0 : !this.has('m3-version') ? 1 : !this.has('m3-key') ? 2 : !this.has('m3-ssh') ? 3 : 4;
  }
  proactiveFeedback(input, output) {
    const cyan = '\x1b[1;36m';
    const yellow = '\x1b[1;33m';
    const magenta = '\x1b[1;35m';
    const green = '\x1b[1;32m';
    const white = '\x1b[1;37m';
    const reset = '\x1b[0m';
    const tag = (color, label) => `${color}[${label}]${reset}`;
    const observed = output ? output.split('\n').slice(0, 3).join(' ').slice(0, 320) : 'The command completed without textual output.';
    const mission = this.activeMission;
    if (this.state.complete.length === this.world.missions.length) return `${cyan}[ACADEMY FEEDBACK — CURRICULUM COMPLETE]${reset}\n${tag(yellow, 'OBSERVATION')}\n${observed}\n${tag(magenta, 'WHY / THEORY')}\nAll four modules are recorded complete; your saved progress is now a reproducible training record.\n${tag(green, 'NEXT STEP / HOW')}\n${white}missions${reset}\nBreakdown: review the completed checklist and revisit any concept with learn <topic>.`;
    if (!mission) return `${cyan}[ACADEMY FEEDBACK]${reset}\n${tag(yellow, 'OBSERVATION')}\nThe command ran.\n${tag(magenta, 'WHY / THEORY')}\nCommands operate only in the virtual academy.\n${tag(green, 'NEXT STEP / HOW')}\n${white}briefing${reset}\nBreakdown: display the current objective.`;
    const index = Math.min(this.stepIndex(), mission.steps.length - 1);
    const step = this.world.academy?.steps?.[`${mission.id}-${index + 1}`];
    const observation = step?.observation || `Current objective: ${mission.steps[index]}.`;
    const theory = step?.theory || `The current phase is ${mission.title}; preserve scope and verify each result before moving on.`;
    const next = step?.command || 'mentor';
    const breakdown = step?.breakdown || 'mentor displays the current objective and a guided action.';
    const skipped = /premature|must complete|first run|before (?:you|using|that)|not reachable until|need to/i.test(output || '');
    return `${cyan}[ACADEMY FEEDBACK — ${step?.module || mission.title} | Step ${index + 1}/${mission.steps.length}]${reset}\n` +
      `${tag(yellow, 'OBSERVATION')}\n${observed}${skipped ? '\nThis action is out of sequence; the current prerequisite remains incomplete.' : `\nFocus: ${observation}`}\n` +
      `${tag(magenta, 'WHY / THEORY')}\n${theory}\n` +
      `${tag(green, 'NEXT STEP / HOW')}\n${white}${next}${reset}\nBreakdown: ${breakdown}`;
  }
  mentor() {
    const mission = this.activeMission; const index = Math.min(this.stepIndex(), mission.steps.length - 1); const lesson = this.world.academy?.steps?.[`${mission.id}-${index + 1}`]; const advice = this.world.mentor[`${mission.id}-${index + 1}`] || [];
    if (lesson) return `Mentor — ${lesson.module}, Step ${index + 1}\n[OBSERVATION] ${lesson.observation}\n[WHY / THEORY] ${lesson.theory}\n[NEXT STEP / HOW] ${lesson.command}\n  Breakdown: ${lesson.breakdown}`;
    if (advice.length >= 3) return `Mentor — ${mission.title}, step ${index + 1}/${mission.steps.length}\n${advice.slice(0, 3).join('\n')}`;
    return `Mentor — ${mission.title}, step ${index + 1}/${mission.steps.length}\nObservation: ${mission.steps[index]}\nTheory: ${advice[0] || mission.objective}\nAction: ${advice.at(-1) || mission.objective}`;
  }
  missions() {
    return this.world.missions.map(m => {
      const done = this.state.complete.includes(m.id); const idx = this.activeMission.id === m.id ? this.stepIndex() : 0;
      return `${done ? '[x]' : '[ ]'} ${m.id.toUpperCase()} — ${m.title}${this.activeMission.id === m.id ? ' [active]' : ''}\n${m.steps.map((s, i) => `${done || i < idx ? '[x]' : '[ ]'} ${i + 1}. ${s}`).join('\n')}\nObjective: ${m.objective}`;
    }).join('\n\n');
  }
  briefing() { const m = this.activeMission; return `${m.title}\nTarget: ${m.target}\nObjective: ${m.objective}\nScope: simulated hosts listed in worldData.js only. Type mentor for a guided three-part nudge.`; }
  man(tool) {
    if (this.world.man?.[tool]) return this.world.man[tool];
    const pages = {
      nmap: 'nmap [flags] <authorized-host>\n-sV detects versions; -sC runs default scripts; -p- scans all TCP ports; -sn performs host discovery. Example: nmap -sV -sC -p- 192.168.1.50.',
      curl: 'curl http://<host>/<path> requests a simulated web resource. Example: curl http://192.168.1.50/robots.txt.',
      searchsploit: 'searchsploit <product/version> searches the local advisory catalog. A hit is a research lead, not proof of vulnerability.',
      exploit: 'exploit <CVE> <target> invokes a lab-only module for a listed target. Example: exploit CVE-2020-1938 192.168.1.60.',
      john: 'john <hash> <wordlist> tests candidate passwords from an authorized wordlist. Example: john sha256:<digest> /home/elliot/wordlist.txt.',
      ssh: 'ssh [user@]<host> [-i <key>] opens a simulated remote session. Example: ssh backup@192.168.1.50.',
      ls: 'ls [-a|-l|-la] [path] lists virtual directory entries. -a includes hidden entries; -l includes mode, owner, and group.',
      find: 'find [path] [-name pattern] [-perm -4000] searches the virtual filesystem. -perm -4000 selects SUID entries.',
      grep: 'grep <pattern> [file] filters file lines; it also accepts piped command output. Example: cat /etc/passwd | grep www-data.',
      chmod: 'chmod <octal-mode> <path> changes a simulated file mode. 600 protects private keys; 4755 sets SUID plus 755 permissions.',
      sudo: 'sudo -l lists explicitly granted commands. In this lab, only listed rules can be run with simulated elevated rights.',
      cat: 'cat <file> prints a readable virtual file. Parent directories must be traversable and the file must grant read permission.',
      cd: 'cd <directory> changes the simulated current directory. Supports absolute, relative, ., .., and ~ paths.'
    };
    return pages[tool] || `No manual entry for ${tool || '(missing)'}. Available: ${Object.keys(pages).join(', ')}.`;
  }
  explain(args) {
    const command = Array.isArray(args) ? args[0] : args;
    const flag = Array.isArray(args) ? args.find(value => value.startsWith('-') || /^0?[0-7]{3,4}$/.test(value)) : null;
    const entry = this.world.explanations?.[command];
    const normalizedFlag = flag?.replace(/^0/, '') || flag;
    const text = entry ? (normalizedFlag && entry.flags?.[normalizedFlag] ? `${normalizedFlag}: ${entry.flags[normalizedFlag]}` : entry.default) : this.man(command);
    return `${text}\nCurrent mission: ${this.activeMission.title}. Execution and permission changes are limited to the virtual lab.`;
  }
  learn(topic) { return this.world.lessons[topic] || `Topics: ${Object.keys(this.world.lessons).join(', ')}`; }
  irc() {
    const key = crypto.scryptSync(this.world.irc.key, 'fsociety-irc', 32);
    return this.world.irc.messages.map((message, i) => { const iv = crypto.createHash('sha256').update(String(i)).digest().subarray(0, 12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]); const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(cipher.getAuthTag()); return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8'); }).join('\n');
  }
  ip() { if (this.state.complete.includes('mission2')) this.mark('m3-route'); return `lo 127.0.0.1\neth0 192.168.1.23/24\nroutes: ${this.state.routes.join(', ')}`; }
  uidFor(value) { return numericId(value, 65534); }
  gidFor(file) { return numericId(file.gid ?? file.group, 65534); }
  permissionBits(file) {
    const uid = this.session.euid; const gid = this.session.egid; const groups = this.session.groups || [this.session.gid];
    if (uid === 0) return { read: true, write: true, execute: !!(modeOf(file) & 0o111) || file.type === 'dir' };
    const mode = modeOf(file); const shift = uid === this.uidFor(file.uid ?? file.owner) ? 6 : (gid === this.gidFor(file) || groups.includes(this.gidFor(file))) ? 3 : 0;
    return { read: !!(mode & (0o400 >> (6 - shift))), write: !!(mode & (0o200 >> (6 - shift))), execute: !!(mode & (0o100 >> (6 - shift))) };
  }
  mayTraverse(dirPath) {
    let current = '/';
    for (const part of dirPath.split('/').filter(Boolean)) { current = path.posix.join(current, part); const entry = this.files[current]; if (!entry || entry.type !== 'dir') return false; if (!this.permissionBits(entry).execute) return false; }
    return true;
  }
  resolve(input = '.') {
    const expanded = input === '~' ? '/home/elliot' : input.startsWith('~/') ? `/home/elliot/${input.slice(2)}` : input;
    return path.posix.resolve(this.session.cwd, expanded);
  }
  id() { const s = this.session; const groupNames = [...new Set([s.egid, ...(s.groups || [])])].map(gid => `${gid}(${ID_USERS[gid] || (gid === 27 ? 'sudo' : 'group')})`).join(','); return `uid=${s.euid}(${ID_USERS[s.euid] || 'unknown'}) gid=${s.egid}(${ID_USERS[s.egid] || 'group'}) groups=${groupNames}`; }
  statLine(file, name) {
    const mode = modeOf(file); const type = file.type === 'dir' ? 'd' : file.type === 'link' ? 'l' : '-';
    const bits = [[0o400,'r'],[0o200,'w'],[0o100,'x'],[0o040,'r'],[0o020,'w'],[0o010,'x'],[0o004,'r'],[0o002,'w'],[0o001,'x']];
    let permissions = bits.map(([bit, char], i) => {
      if (i === 2 && mode & 0o4000) return mode & bit ? 's' : 'S';
      if (i === 5 && mode & 0o2000) return mode & bit ? 's' : 'S';
      if (i === 8 && mode & 0o1000) return mode & bit ? 't' : 'T';
      return mode & bit ? char : '-';
    }).join('');
    const owner = ID_USERS[this.uidFor(file.uid ?? file.owner)] || file.owner || '?'; const group = ID_USERS[this.gidFor(file)] || file.group || '?';
    return `${type}${permissions} ${owner} ${group} ${name}`;
  }
  ls(args) {
    let all = false, long = false; const paths = [];
    for (const arg of args) { if (arg.startsWith('-')) { if (arg.includes('a')) all = true; if (arg.includes('l')) long = true; } else paths.push(arg); }
    if (paths.length > 1) return paths.map(p => `${p}:\n${this.ls([...args.filter(x => x.startsWith('-')), p])}`).join('\n');
    const target = this.resolve(paths[0] || '.'); const entry = this.files[target];
    if (!entry) return `ls: cannot access '${paths[0] || target}': No such file or directory`;
    if (entry.type !== 'dir') {
      if (this.session.target === '192.168.1.50' && this.has('m1-ssh') && !this.has('m2-find') && ['/usr/local/bin/backup-sync','/opt/scripts/rotate.sh'].includes(target)) return 'Premature: enumerate SUID files with find / -perm -4000 before inspecting their dependencies.';
      if (!this.permissionBits(entry).read || !this.mayTraverse(path.posix.dirname(target))) return `ls: cannot access '${target}': Permission denied`;
      if (long && this.session.target === '192.168.1.50' && this.has('m2-find') && target === '/opt/scripts/rotate.sh') {
        this.mark('m2-script-mode');
        if (this.has('m2-binary-inspected') && this.has('m2-script-inspected')) this.mark('m2-inspect');
      }
      return long ? this.statLine(entry, path.posix.basename(target)) : path.posix.basename(target);
    }
    if (!this.permissionBits(entry).read || !this.permissionBits(entry).execute) return `ls: cannot open directory '${target}': Permission denied`;
    const children = Object.entries(this.files).filter(([p]) => p !== target && path.posix.dirname(p) === target && (all || !path.posix.basename(p).startsWith('.')));
    if (!long) return children.map(([p]) => path.posix.basename(p)).join('  ');
    const hiddenDots = all ? [`${this.statLine(entry, '.')}`, `${this.statLine(entry, '..')}`] : [];
    return [...hiddenDots, ...children.map(([p, f]) => this.statLine(f, path.posix.basename(p)))].join('\n');
  }
  cd(input = '~') {
    const dest = this.resolve(input); const entry = this.files[dest];
    if (!entry || entry.type !== 'dir') return `cd: ${input}: No such directory`;
    if (!this.mayTraverse(dest) || !this.permissionBits(entry).execute) return `cd: ${input}: Permission denied`;
    this.session.cwd = dest; return '';
  }
  cat(args) {
    if (!args.length) return 'cat: missing operand';
    const outputs = [];
    for (const input of args) { const dest = this.resolve(input); const file = this.files[dest]; if (!file) return `cat: ${input}: No such file`; if (file.type === 'dir') return `cat: ${input}: Is a directory`; if (!this.mayTraverse(path.posix.dirname(dest)) || !this.permissionBits(file).read) return `cat: ${input}: Permission denied`; outputs.push(file.content || '');
      if (this.session.target === '192.168.1.50' && !this.has('m1-ssh') && ['/usr/local/bin/backup-sync','/opt/scripts/rotate.sh','/var/backups/ops.txt'].includes(input)) return 'Premature: establish the authorized SSH foothold before inspecting post-exploitation files.';
      if (this.session.target === '192.168.1.50' && this.has('m1-ssh') && !this.has('m2-find') && ['/usr/local/bin/backup-sync','/opt/scripts/rotate.sh'].includes(input)) return 'Premature: enumerate SUID files with find / -perm -4000 before inspecting their dependencies.';
      if ((input === '/root/proof.txt' && (this.session.euid === 0 || this.session.target === '10.10.10.25')) || (input === '/var/lib/postgresql/academy.flag' && this.session.target === '10.10.10.25')) this.completeMissionFor(this.session.target);
      if (this.session.target === '192.168.1.50' && input === '/usr/local/bin/backup-sync') this.mark('m2-binary-inspected');
      if (this.session.target === '192.168.1.50' && input === '/opt/scripts/rotate.sh') this.mark('m2-script-inspected');
      if (this.session.target === '192.168.1.50' && this.has('m2-binary-inspected') && this.has('m2-script-inspected') && this.has('m2-script-mode')) this.mark('m2-inspect');
      if (this.session.target === '192.168.1.60' && input === '/var/backups/id_rsa') { this.world.local.files['/home/elliot/id_rsa'] = { type: 'file', content: file.content, owner: 'elliot', group: 'elliot', uid: 1000, gid: 1000, mode: '644' }; this.mark('m3-key'); }
    }
    return outputs.join('\n');
  }
  completeMissionFor(target) {
    const id = target === '192.168.1.50' ? 'mission1' : target === '192.168.1.60' ? 'mission2' : target === '10.10.10.25' ? 'mission3' : null;
    if (id && !this.state.complete.includes(id)) this.state.complete.push(id);
    if (id === 'mission2' && !this.state.routes.includes('10.10.10.0/24')) this.state.routes.push('10.10.10.0/24');
  }
  grep(args, source = null) {
    const pattern = args[0]; if (!pattern) return 'Usage: grep <pattern> [file]';
    let input = source ?? '';
    if (args[1]) { const result = this.cat(args.slice(1)); if (result.startsWith('cat:')) return result; input = result; }
    return input.split('\n').filter(line => line.includes(pattern)).join('\n');
  }
  find(args) {
    let root = '/'; let name = null; let perm = false;
    for (let i = 0; i < args.length; i++) { if (args[i] === '2' || args[i] === '/dev/null') continue; if (args[i] === '-name') name = args[++i]; else if (args[i] === '-perm') { perm = args[++i] === '-4000' || args[i] === '4000'; } else if (!args[i].startsWith('-')) root = this.resolve(args[i]); }
    if (args.includes('-perm') && !perm) return 'find: supported permission filter is -perm -4000';
    const items = Object.entries(this.files).filter(([p, f]) => (p === root || p.startsWith(root.endsWith('/') ? root : `${root}/`)) && (!name || path.posix.basename(p) === name) && (!perm || !!(modeOf(f) & 0o4000)) && this.mayTraverse(path.posix.dirname(p)));
    if (perm && this.session.target === '192.168.1.50') { if (!this.has('m1-ssh')) return 'Premature: first establish the www-data session, then enumerate its SUID files.'; if (items.length) this.mark('m2-find'); }
    if (!perm && this.session.target === '192.168.1.50') return items.map(([p]) => p).join('\n') + '\n[Mr. Robot Tip] Add -perm -4000 to locate SUID executables.';
    return items.map(([p]) => p).join('\n') || 'No matching paths.';
  }
  chmod(args) {
    if (args.length < 2) return 'Usage: chmod <octal-mode> <path>';
    if (!/^[0-7]{3,4}$/.test(args[0])) return 'chmod: mode must be three or four octal digits';
    const p = this.resolve(args[1]); const file = this.files[p]; if (!file) return `chmod: cannot access '${args[1]}': No such file`;
    if (!this.mayTraverse(path.posix.dirname(p))) return `chmod: cannot access '${args[1]}': Permission denied`;
    if (this.session.euid !== 0 && this.session.uid !== this.uidFor(file.uid ?? file.owner)) return 'chmod: Operation not permitted';
    file.mode = args[0]; if (p.endsWith('id_rsa') && modeOf(file) === 0o600) this.mark('m3-key'); return '';
  }
  redirect(output, inputPath, append) {
    const dest = this.resolve(inputPath); let file = this.files[dest]; const parentPath = path.posix.dirname(dest); const parent = this.files[parentPath];
    if (this.session.target === '192.168.1.50' && dest === '/opt/scripts/rotate.sh' && !this.has('m2-inspect')) return 'Premature: enumerate the SUID binary and verify the script owner and write permission before modifying it.';
    if (!parent || parent.type !== 'dir') return `sh: ${inputPath}: No such directory`;
    if (!this.mayTraverse(parentPath)) return `sh: ${inputPath}: Permission denied`;
    if (!file) {
      if (!this.permissionBits(parent).write) return `sh: ${inputPath}: Permission denied`;
      file = { type: 'file', content: '', uid: this.session.euid, gid: this.session.egid, owner: ID_USERS[this.session.euid] || this.session.user, group: ID_USERS[this.session.egid] || this.session.user, mode: '644' };
      this.files[dest] = file;
    }
    if (file.type !== 'file') return `sh: ${inputPath}: Is a directory`;
    if (!this.permissionBits(file).write) return `sh: ${inputPath}: Permission denied`;
    file.content = append ? `${file.content || ''}${output}\n` : output;
    if (this.session.target === '192.168.1.50' && dest === '/opt/scripts/rotate.sh' && output.trim() === 'id') this.mark('m2-script');
    return '';
  }
  async execute(command) {
    const p = this.resolve(command); const file = this.files[p]; if (!file) return `${command}: No such file or directory`;
    if (p === '/usr/local/bin/backup-sync' && this.session.target === '192.168.1.50' && !this.has('m2-script')) return 'Premature: inspect the SUID program and writable dependency, then update the script with the lab identity marker before execution.';
    if (!this.mayTraverse(path.posix.dirname(p))) return `${command}: Permission denied`;
    if (file.type !== 'file') return `${command}: is a directory`;
    const mode = modeOf(file); const perms = this.permissionBits(file);
    if (!perms.execute) return `${command}: Permission denied (execute bit is not set)`;
    const originalEuid = this.session.euid; const originalEgid = this.session.egid;
    if (mode & 0o4000) this.session.euid = this.uidFor(file.uid ?? file.owner);
    if (mode & 0o2000) this.session.egid = this.gidFor(file);
    if (p === '/usr/local/bin/backup-sync' && this.session.target === '192.168.1.50') {
      const script = this.files['/opt/scripts/rotate.sh'];
      if (script?.content?.trim() === 'id' && this.session.euid === 0) { this.mark('m2-root'); return 'uid=0(root) gid=33(www-data)\nEffective simulated root shell granted by the SUID maintenance utility.'; }
      this.session.euid = originalEuid; this.session.egid = originalEgid;
      return 'backup-sync: routine maintenance completed (simulated).';
    }
    this.session.euid = originalEuid; this.session.egid = originalEgid;
    if (file.content?.startsWith('#!')) return `sh: ${path.posix.basename(p)}: simulated script interpreter is unavailable`;
    return file.content || '';
  }
  sudo(args) {
    if (args[0] === '-l') {
      if (this.session.target === '192.168.1.60' && this.session.user === 'deploy') { this.mark('m2-sudo'); return 'Matching Defaults entries for deploy:\n(deploy) NOPASSWD: /usr/bin/journalctl'; }
      return this.session.euid === 0 ? 'User root may run any command.' : `User ${this.session.user} may not run sudo on ${this.session.host}.`;
    }
    if (this.session.target === '192.168.1.60' && this.session.user === 'deploy' && args[0] === '/usr/bin/journalctl') {
      if (!this.has('m2-sudo')) return 'Premature: run sudo -l and inspect the exact permitted command before invoking it.';
      this.session.euid = 0; this.session.cwd = '/root'; this.state.mission2Root = true; return 'Simulated sudo journalctl escape validated; effective uid is now 0 (root).';
    }
    return 'sudo: command not permitted in this lab scenario.';
  }
  su(args) {
    const requested = args[0] || 'root';
    if (requested === 'root' && this.session.euid === 0) return 'Already running with effective UID 0.';
    if (requested === 'root') return 'su: Authentication failure. No root password has been discovered in this lab.';
    const account = this.target?.users?.[requested];
    if (!account) return `su: user ${requested} does not exist in this simulated host.`;
    if (requested === 'backup' && this.state.credentials.backup && this.session.target === '192.168.1.50') {
      this.session.user = 'backup'; this.session.uid = 1001; this.session.gid = 1001; this.session.euid = 1001; this.session.egid = 1001; this.session.groups = [1001]; this.session.cwd = '/home/backup';
      return 'Identity changed to backup (uid=1001).';
    }
    return 'su: Authentication failure.';
  }
  async nmap(args) {
    const host = args.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x));
    if (args.includes('-sn') && !host) { this.mark('m1-host'); return 'Nmap host discovery: 192.168.1.50 is up (simulated lab).'; }
    const target = this.lookup(host); if (!target) return 'Nmap: host is outside the simulation or unavailable.';
    if (host === '192.168.1.60' && !this.state.complete.includes('mission1')) return 'Premature: complete the web01 modules and read their proof before enumerating api01.internal.';
    if (host === '10.10.10.25' && !this.state.complete.includes('mission2')) return 'Nmap: internal target is not reachable until the API objective is complete.';
    const version = args.includes('-sV'); const scripts = args.includes('-sC'); const all = args.includes('-p-');
    if (host === '192.168.1.50') { this.mark('m1-host'); if (version && scripts) this.mark('m1-scan'); }
    if (version && host === '192.168.1.50') this.mark('m1-version');
    if (version && host === '192.168.1.60') { this.mark('m2-version'); if (scripts) this.mark('m2-scan'); }
    if (version && host === '10.10.10.25') this.mark('m3-version');
    this.state.scanned[host] = { version, scripts }; process.stdout.write('Starting Nmap 7.94 ( simulated lab )\n'); await sleep(220);
    const rows = Object.entries(target.ports).filter(([port]) => all || ['22','80','8080'].includes(port)).map(([port, service]) => `${port}/tcp open ${service.service}${version ? ` ${service.banner}` : ''}${scripts && service.scripts ? `\n|_ ${service.scripts}` : ''}`).join('\n');
    return `Nmap scan report for ${target.hostname} (${host})\nHost is up (0.018s latency).\nPORT   STATE SERVICE${version ? ' VERSION' : ''}\n${rows}\nNmap done: 1 IP address (1 host up) scanned in 0.22 seconds${version ? '' : '\n[Mr. Robot Tip] Add -sV to identify exact service versions before vulnerability research.'}`;
  }
  async curl(args) {
    const raw = args.find(x => x.startsWith('http')); if (!raw) return 'Usage: curl http://192.168.1.50/robots.txt';
    let url; try { url = new URL(raw); } catch { return 'curl: malformed URL'; }
    const target = this.lookup(url.hostname); if (!target) return 'curl: host unreachable'; await sleep(60);
    if (url.hostname === '192.168.1.50' && !this.has('m1-scan')) return 'Premature: fingerprint the HTTP service with nmap -sV -sC before retrieving web resources.';
    const body = target.routes[url.pathname]; if (body === undefined) return `HTTP/1.1 404 Not Found\nServer: ${Object.values(target.ports)[0].banner}`;
    if (url.hostname === '192.168.1.50' && ['/robots.txt','/.git/config','/backup/app.conf'].includes(url.pathname)) {
      this.state.discovered[url.pathname] = true;
      if (url.pathname === '/backup/app.conf') this.mark('m1-config');
      if (this.state.discovered['/robots.txt'] && (this.state.discovered['/.git/config'] || this.state.discovered['/backup/app.conf'])) this.mark('m1-web');
    }
    return `HTTP/1.1 200 OK\nServer: ${Object.values(target.ports).find(s => s.service.includes('http'))?.banner || 'simulated'}\n\n${body}${url.pathname === '/robots.txt' ? '\n[Mr. Robot Tip] Follow the listed paths with separate curl requests.' : ''}`;
  }
  lookup(host) { return this.world.network[host] || Object.values(this.world.network).find(t => t.hostname === host || t.domain === host); }
  searchsploit(term) {
    const hits = Object.values(this.world.network).flatMap(t => t.vulnerabilities || []).filter(v => `${v.id} ${v.product} ${v.description}`.toLowerCase().includes(term.toLowerCase()));
    if (hits.length && !this.has('m2-scan')) return 'Premature: verify api01.internal with nmap -sV -sC before searching advisories.';
    if (hits.length && this.state.scanned['192.168.1.60']?.version) this.mark('m2-search');
    return hits.length ? hits.map(v => `${v.id} | ${v.product} | ${v.description}`).join('\n') : 'No results found in the local training database.';
  }
  exploit(args) {
    const [id, host] = args; const target = this.lookup(host); if (!target) return 'Usage: exploit <CVE> <listed-target>';
    if (host === '192.168.1.60' && (!this.state.scanned[host]?.version || !this.has('m2-search'))) return 'Premature: confirm the service with nmap -sV -sC and match a result with searchsploit first.';
    if (host === '192.168.1.60' && !this.state.complete.includes('mission1')) return 'Premature: finish both web01 modules and read the root proof before moving to api01.internal.';
    if (host === '192.168.1.60' && target.vulnerabilities.some(v => v.id.toLowerCase() === String(id).toLowerCase())) { this.state.mission2Exploit = true; this.state.sessions.push({ user: 'deploy', uid: 1002, gid: 1002, euid: 1002, egid: 1002, groups: [1002], host: target.hostname, cwd: '/home/deploy', target: host }); return `Validated ${id} against the simulated lab service. Interactive shell established as deploy.`; }
    return host === '192.168.1.50' ? 'The traversal module demonstrates file disclosure only; use the recovered evidence to establish the SSH foothold.' : 'No matching lab module for that CVE and target.';
  }
  john(args) {
    if (!this.has('m1-config')) return 'Premature: retrieve /backup/app.conf before auditing a hash.';
    const hash = args[0]; const wordlist = this.resolve(args[1] || ''); const file = this.files[wordlist] || this.world.local.files[wordlist];
    if (!hash || !file || file.type !== 'file') return 'Usage: john <hash> <wordlist>; use the supplied wordlist discovered during recon.';
    const expected = `sha256:${crypto.createHash('sha256').update('ER28-0652').digest('hex')}`;
    if (hash !== expected || !file.content.split(/\s+/).includes('ER28-0652')) return 'No passwords cracked; supplied hash or wordlist did not match.';
    this.state.credentials.backup = true; this.mark('m1-john'); return 'Loaded 1 simulated SHA-256 hash\nER28-0652 (backup)\n1 password cracked, 0 left';
  }
  ssh(args) {
    const host = args.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x)); const target = this.lookup(host); if (!target) return 'ssh: host unreachable';
    if (!this.state.scanned[host]) return 'Enumerate the host with nmap before connecting.';
    if (host === '192.168.1.60') return 'Premature: validate the Tomcat advisory and use the authorized academy exploit trigger to establish the deploy session.';
    const keyIndex = args.indexOf('-i'); const keyPath = keyIndex >= 0 ? this.resolve(args[keyIndex + 1]) : ''; const userArg = args.find(x => x.includes('@')); const username = userArg?.split('@')[0] || 'backup'; const account = target.users?.[username]; if (!account) return 'Permission denied (unknown simulated user).';
    if (host === '192.168.1.50' && (!this.has('m1-john') || !this.state.credentials.backup || !this.state.discovered['/backup/app.conf'])) return 'Premature: retrieve the exposed hash and validate it with the supplied wordlist before SSH authentication.';
    if (host === '10.10.10.25') {
      if (!this.state.complete.includes('mission2') || !this.state.routes.includes('10.10.10.0/24')) return 'Internal route is unavailable until the API objective is complete.';
      const key = this.world.local.files[keyPath]; if (!key || modeOf(key) !== 0o600 || !key.content.includes(account.key)) return 'Permission denied: locate the authorized key and set mode 600 with chmod.';
      this.mark('m3-ssh');
    }
    if (host === '192.168.1.50') this.mark('m1-ssh');
    this.state.sessions.push({ user: account.shell, uid: USER_IDS[account.shell] ?? USER_IDS[username] ?? 1001, gid: USER_IDS[account.shell] ?? USER_IDS[username] ?? 1001, euid: USER_IDS[account.shell] ?? USER_IDS[username] ?? 1001, egid: USER_IDS[account.shell] ?? USER_IDS[username] ?? 1001, groups: [USER_IDS[account.shell] ?? USER_IDS[username] ?? 1001], host: target.hostname, cwd: account.shell === 'www-data' ? '/var/www/html' : `/home/${username}`, target: host });
    return `Authenticated to ${host}.\nInteractive simulated shell established as ${account.shell}.`;
  }
  exit() { if (this.session.euid !== this.session.uid) this.session.euid = this.session.uid; if (this.state.sessions.length <= 1) return 'Already at local console.'; this.state.sessions.pop(); return `Disconnected. Returned to ${this.effectiveUser}@${this.session.host}.`; }
  complete(input) {
    const before = input.slice(0, input.lastIndexOf(' ') + 1); const fragment = input.slice(before.length);
    if (!before) return ['help','mentor','missions','man','learn','explain','briefing','irc','pwd','whoami','id','ls','cd','cat','echo','grep','find','chmod','sudo','su','history','exit','nmap','curl','searchsploit','exploit','john','ssh','ip','save','load','clear','cls'].filter(x => x.startsWith(fragment));
    const partial = fragment || '.'; const absolute = partial.startsWith('/') || partial.startsWith('~'); const hasSlash = partial.endsWith('/'); const typedDir = hasSlash ? partial : path.posix.dirname(partial); const parent = this.resolve(typedDir || '.'); const base = hasSlash ? '' : path.posix.basename(partial);
    const names = Object.keys(this.files).filter(p => path.posix.dirname(p) === parent && path.posix.basename(p).startsWith(base)).map(p => absolute ? p : path.posix.join(typedDir === '.' ? '' : typedDir, path.posix.basename(p)));
    return names.length ? names : ['-la','-l','-a','-sV','-sC','-p-','-sn','-perm','-4000','-name'].filter(x => x.startsWith(fragment));
  }
  async save() { try { await fs.writeFile('savegame.json', JSON.stringify({ state: this.state, world: this.world }, null, 2), 'utf8'); return 'Game saved.'; } catch (error) { return `Save failed: ${error.message}`; } }
  async load() { try { const data = JSON.parse(await fs.readFile('savegame.json', 'utf8')); if (!Array.isArray(data.state?.sessions) || !data.world?.network) throw new Error('Invalid save'); this.state = data.state; this.world = data.world; return 'Game loaded.'; } catch { return 'No valid savegame.json found.'; } }
}
