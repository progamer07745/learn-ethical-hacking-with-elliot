import readline from 'node:readline';
import { Engine } from './engine.js';

const GREEN = text => `\x1b[32m${text}\x1b[0m`;
const BLUE = text => `\x1b[34m${text}\x1b[0m`;
const CYAN = text => `\x1b[36m${text}\x1b[0m`;
const engine = new Engine();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  historySize: 500,
  completer(line) {
    const candidates = engine.complete(line);
    const fragment = line.slice(line.lastIndexOf(' ') + 1);
    return [candidates.length ? candidates : [], fragment];
  }
});

const prompt = () => {
  const { user, host, cwd, euid } = engine.session;
  const visibleUser = euid === 0 ? 'root' : user;
  return `${GREEN(`${visibleUser}@${host}`)}:${BLUE(cwd)}${euid === 0 ? '# ' : '$ '}`;
};

console.log(CYAN('E-Corp / fsociety terminal academy'));
console.log('Fictional, isolated lab environment. Type help, briefing, missions, or mentor.\n');

let closed = false;
rl.on('close', () => { closed = true; });
rl.on('SIGINT', () => {
  if (rl.line) rl.write('', { ctrl: true, name: 'u' });
  else rl.close();
});

function ask() {
  if (closed) return;
  rl.question(prompt(), async line => {
    const result = await engine.run(line);
    if (result) process.stdout.write(`${result}\n`);
    ask();
  });
}

ask();
