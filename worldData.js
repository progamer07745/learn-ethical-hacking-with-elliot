const makeDir = (owner = 'root', mode = '755', extra = {}) => ({ type: 'dir', content: '', owner, group: owner, mode, ...extra });
const makeFile = (content, owner = 'root', mode = '644', extra = {}) => ({ type: 'file', content, owner, group: owner, mode, ...extra });
const hash = 'sha256:5e35b06f4ceeb18cad5589373b844ff1a75fb61548d102e2cf519bdff4b1aa2a';
const webFiles = {
  '/': makeDir(), '/etc': makeDir(), '/etc/passwd': makeFile('root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nbackup:x:1001:1001:Backup:/home/backup:/bin/bash'),
  '/var': makeDir(), '/var/www': makeDir('www-data'), '/var/www/html': makeDir('www-data'), '/var/www/html/index.html': makeFile('Web01 internal staging portal. Build 2021.10', 'www-data'),
  '/var/backups': makeDir(), '/var/backups/ops.txt': makeFile('Nightly maintenance runs /usr/local/bin/backup-sync as root. The SUID utility invokes /opt/scripts/rotate.sh.', 'root', '644'),
  '/opt': makeDir(), '/opt/scripts': makeDir(), '/opt/scripts/rotate.sh': makeFile('#!/bin/sh\necho rotation complete\n', 'www-data', '755'),
  '/usr': makeDir(), '/usr/local': makeDir(), '/usr/local/bin': makeDir(), '/usr/local/bin/backup-sync': makeFile('SIMULATED SUID utility. It invokes /opt/scripts/rotate.sh with effective UID 0.', 'root', '4755'),
  '/home': makeDir(), '/home/backup': makeDir('backup', '750'), '/home/backup/.bash_history': makeFile('ls -la\nsudo -l\n/usr/local/bin/backup-sync', 'backup', '640'),
  '/root': makeDir('root', '700'), '/root/proof.txt': makeFile('MODULE 2 COMPLETE\nFlag: FSOCIETY{suid_script_hijack}', 'root', '600')
};

export const world = {
  local: {
    user: 'elliot', host: 'kali', cwd: '/home/elliot',
    files: {
      '/': makeDir(), '/home': makeDir(), '/home/elliot': makeDir('elliot'), '/home/elliot/.ssh': makeDir('elliot', '700'),
      '/home/elliot/README.txt': makeFile('AUTHORIZED TRAINING LAB\nAll hosts, services, credentials, and commands are fictional and isolated.', 'elliot'),
      '/home/elliot/notes.txt': makeFile('Module 1 target: web01.internal (192.168.1.50).\nWordlist: /home/elliot/wordlist.txt.', 'elliot', '600'),
      '/home/elliot/wordlist.txt': makeFile('root\nadmin\nwelcome\nER28-0652\npassword123\n', 'elliot', '600'),
      '/home/elliot/.ssh/id_ed25519': makeFile('SIMULATED PRIVATE KEY: kali-to-lab', 'elliot', '600')
    }
  },
  topology: {
    name: 'E-Corp Training Network',
    nodes: [
      { hostname: 'web01.internal', address: '192.168.1.50', modules: ['module1', 'module2'], zone: 'external-lab' },
      { hostname: 'api01.internal', address: '192.168.1.60', modules: ['module3'], zone: 'external-lab' },
      { hostname: 'db01.secure.local', address: '10.10.10.25', modules: ['module4'], zone: 'secure-internal' }
    ],
    edges: [
      { from: 'kali', to: '192.168.1.50', access: 'simulated public lab target' },
      { from: 'kali', to: '192.168.1.60', access: 'simulated public lab target' },
      { from: '192.168.1.60', to: '10.10.10.25', access: 'authorized pivot route unlocked after API root proof' }
    ],
    routes: { public: ['192.168.1.0/24'], pivot: ['10.10.10.0/24'], pivotUnlock: 'mission2' }
  },
  network: {
    '192.168.1.50': {
      hostname: 'web01.internal', domain: 'web01.internal', os: 'Ubuntu Linux', modules: ['module1', 'module2'],
      ports: {
        '22': { service: 'ssh', banner: 'OpenSSH 8.2p1 Ubuntu 4ubuntu0.5', scripts: 'ssh-hostkey: simulated ED25519 fingerprint' },
        '80': { service: 'http', banner: 'Apache httpd 2.4.49', scripts: 'http-title: Web01 internal; http-methods: GET HEAD POST OPTIONS' }
      },
      routes: {
        '/': '<html><title>web01.internal</title><p>Internal staging portal</p></html>',
        '/robots.txt': 'Disallow: /.git/\nDisallow: /backup/',
        '/.git/config': '[remote "origin"]\nurl = git://web01.internal/staging.git\n[branch "main"]',
        '/backup/app.conf': `DB_USER=backup\nDB_PASSWORD_HASH=${hash}\nWORDLIST=/home/elliot/wordlist.txt`,
        '/backup/users.hash': `backup:${hash}`
      },
      vulnerabilities: [{ id: 'CVE-2021-41773', product: 'Apache httpd 2.4.49', description: 'Path traversal in Apache HTTP Server 2.4.49; this training service models file disclosure only.', path: '/cgi-bin/.%2e/.%2e/.%2e/.%2e/etc/passwd' }],
      users: { backup: { password: 'ER28-0652', shell: 'www-data' } },
      filesystem: webFiles,
      suid: ['/usr/local/bin/backup-sync'],
      cron: ['*/5 * * * * root /usr/local/bin/backup-sync'],
      notes: 'Module 1 reveals a web configuration hash. Module 2 is a separate post-foothold privilege-escalation stage on this same host.'
    },
    '192.168.1.60': {
      hostname: 'api01.internal', domain: 'api01.internal', os: 'Ubuntu Linux', modules: ['module3'],
      ports: {
        '22': { service: 'ssh', banner: 'OpenSSH 8.9p1 Ubuntu 3ubuntu0.6' },
        '8080': { service: 'http-proxy', banner: 'Apache Tomcat 9.0.30', scripts: 'http-title: API Manager; ajp-methods: AJP service version 1.3' }
      },
      routes: { '/': 'api01.internal staging API', '/manager/status': 'Tomcat Manager: enabled\nService account: deploy\nAJP connector: enabled' },
      vulnerabilities: [{ id: 'CVE-2020-1938', product: 'Apache Tomcat 9.0.30', description: 'Ghostcat (CVE-2020-1938), an AJP-related file disclosure issue. Training exploit trigger creates a simulated deploy foothold.' }],
      users: { deploy: { password: 'deploy-lab-only', shell: 'deploy' } },
      filesystem: {
        '/': makeDir(), '/etc': makeDir(), '/etc/passwd': makeFile('root:x:0:0:root:/root:/bin/bash\ndeploy:x:1002:1002:Deploy:/home/deploy:/bin/bash'),
        '/home': makeDir(), '/home/deploy': makeDir('deploy'), '/home/deploy/readme.txt': makeFile('API foothold established. Inspect sudo -l to enumerate explicitly permitted commands.', 'deploy'),
        '/var': makeDir(), '/var/backups': makeDir(), '/var/backups/id_rsa': makeFile('SIMULATED PRIVATE KEY: internal-lab-key', 'deploy', '600'),
        '/usr': makeDir(), '/usr/bin': makeDir(), '/usr/bin/journalctl': makeFile('Simulated system journal viewer; the lab sudo rule exposes a controlled escape path.', 'root', '755'),
        '/root': makeDir('root', '700'), '/root/proof.txt': makeFile('MODULE 3 COMPLETE\nFlag: FSOCIETY{cve_then_validate}', 'root', '600')
      },
      sudoers: { deploy: ['/usr/bin/journalctl'] },
      notes: 'The exercise exploit is a local simulation trigger; it does not send exploit traffic or execute code on real systems.'
    },
    '10.10.10.25': {
      hostname: 'db01.secure.local', domain: 'db01.secure.local', os: 'Debian GNU/Linux', modules: ['module4'],
      ports: { '22': { service: 'ssh', banner: 'OpenSSH 9.2p1 Debian 2+deb12u2', scripts: 'ssh-hostkey: simulated ED25519 fingerprint' }, '5432': { service: 'postgresql', banner: 'PostgreSQL 15.4 (simulated)' } },
      routes: {},
      users: { backup: { key: 'internal-lab-key', shell: 'backup' } },
      filesystem: {
        '/': makeDir(), '/home': makeDir(), '/home/backup': makeDir('backup', '750'), '/home/backup/.ssh': makeDir('backup', '700'),
        '/home/backup/.ssh/id_rsa': makeFile('SIMULATED PRIVATE KEY: internal-lab-key', 'backup', '644'),
        '/var': makeDir(), '/var/backups': makeDir(), '/var/backups/access.txt': makeFile('Key archive metadata: /home/backup/.ssh/id_rsa', 'root'),
        '/var/lib': makeDir(), '/var/lib/postgresql': makeDir('postgres', '755'), '/var/lib/postgresql/academy.flag': makeFile('MODULE 4 COMPLETE\nDatabase flag: FSOCIETY{pivoted_and_exfiltrated}', 'backup', '640'),
        '/root': makeDir('root', '755'), '/root/proof.txt': makeFile('MODULE 4 COMPLETE\nFlag: FSOCIETY{pivoted_and_exfiltrated}', 'root', '644')
      },
      notes: 'Reachable only through the authorized pivot route unlocked after completing module3 on api01.internal.'
    }
  },
  modules: [
    { id: 'module1', number: 1, title: 'Web Recon, Hashes & Initial Access', target: '192.168.1.50', stage: 'recon-and-foothold', objective: 'Enumerate web01.internal, retrieve the exposed configuration hash, crack it with the supplied wordlist, and establish the backup SSH session.' },
    { id: 'module2', number: 2, title: 'SUID Script Hijacking', target: '192.168.1.50', stage: 'post-exploitation', prerequisite: 'module1', objective: 'Inspect the SUID maintenance binary and writable rotate script, validate the simulated privilege escalation, and read the root proof.' },
    { id: 'module3', number: 3, title: 'API CVE & Sudo Abuse', target: '192.168.1.60', stage: 'vulnerability-validation', objective: 'Identify the Tomcat version, find the matching local CVE record, trigger the lab exploit, inspect sudo -l, and read the root proof.' },
    { id: 'module4', number: 4, title: 'Internal Pivot & Database Flag', target: '10.10.10.25', stage: 'pivot-and-objective', prerequisite: 'module3', objective: 'Use the unlocked internal route, recover the lab SSH key, set it to mode 600, authenticate to db01.secure.local, and read the database flag.' }
  ],
  missions: [
    { id: 'mission1', modules: ['module1', 'module2'], title: 'Web Recon & SUID Privilege Escalation', target: '192.168.1.50', objective: 'Complete Modules 1 and 2 on web01.internal and read /root/proof.txt as root.', steps: ['Module 1, Step 1: Verify the web service and capture its banner', 'Module 1, Step 2: Retrieve the exposed backup configuration', 'Module 1, Step 3: Audit the recovered SHA-256 hash with the wordlist', 'Module 1, Step 4: Authenticate through SSH as backup', 'Module 2, Step 1: Enumerate SUID binaries', 'Module 2, Step 2: Inspect backup-sync and rotate.sh permissions', 'Module 2, Step 3: Modify the writable maintenance script', 'Module 2, Step 4: Execute the SUID binary and read the root proof'] },
    { id: 'mission2', modules: ['module3'], title: 'CVE Exploitation & Service Abuse', target: '192.168.1.60', objective: 'Validate the Tomcat CVE in the lab, inspect the sudo misconfiguration, and read the API root proof.', steps: ['Enumerate exact service versions', 'Match the Tomcat banner with searchsploit', 'Trigger the matching custom lab exploit', 'Inspect sudo -l', 'Validate the permitted command', 'Read /root/proof.txt as root'] },
    { id: 'mission3', modules: ['module4'], title: 'Internal Pivot & Database Flag', target: '10.10.10.25', objective: 'Pivot to db01.secure.local with the protected SSH key and read /var/lib/postgresql/academy.flag.', steps: ['Discover the newly available internal route with ip', 'Enumerate the internal database host', 'Locate and retrieve the private key from the API host', 'Set the key mode to 600 and authenticate with ssh -i', 'Read the database flag'] }
  ],
  man: {
    nmap: 'NAME\n  nmap — simulated network discovery and service enumeration\nSYNOPSIS\n  nmap [-sn] [-sV] [-sC] [-p-] <authorized-host>\nOPTIONS\n  -sn   host discovery without a port scan\n  -sV   probe open ports to identify service versions\n  -sC   run the training profile of default enumeration scripts\n  -p-   scan all TCP ports instead of the common lab ports\nEXAMPLE\n  nmap -sV -sC -p- 192.168.1.50\nUse only the isolated addresses in this academy. A version match is evidence to investigate, not proof of exploitability.',
    curl: 'NAME\n  curl — request a simulated HTTP resource\nSYNOPSIS\n  curl http://<host>/<path>\nEXAMPLE\n  curl http://192.168.1.50/robots.txt\nUse the returned paths for follow-up requests, such as /.git/config or /backup/app.conf. The simulator maps only routes defined in worldData.js.',
    searchsploit: 'NAME\n  searchsploit — search the local training advisory catalog\nSYNOPSIS\n  searchsploit <product, version, or CVE>\nEXAMPLE\n  searchsploit Tomcat 9.0.30\nMatch the observed product and version. An advisory hit is a research lead; confirm affected components and scope before testing.',
    exploit: 'NAME\n  exploit — trigger a data-defined training exploit\nSYNOPSIS\n  exploit <CVE-ID> <listed-target-IP>\nEXAMPLE\n  exploit CVE-2020-1938 192.168.1.60\nThis command changes only simulator session state. It does not generate network traffic or run a real exploit.',
    john: `NAME\n  john — validate a candidate password against a simulated hash using a local wordlist\nSYNOPSIS\n  john <hash> <wordlist-path>\nEXAMPLE\n  john ${hash} /home/elliot/wordlist.txt\nThe hash is one-way output. John tests candidate strings from the supplied file and reports a match; use only lab-provided material.`,
    ssh: 'NAME\n  ssh — establish an authenticated simulated shell session\nSYNOPSIS\n  ssh [user@]<target-IP> [-i <private-key>]\nEXAMPLES\n  ssh backup@192.168.1.50\n  ssh -i /home/elliot/id_rsa backup@10.10.10.25\nTarget reachability, account credentials, and key ownership are checked by the academy engine.',
    chmod: 'NAME\n  chmod — change permissions on a virtual file\nSYNOPSIS\n  chmod <octal-mode> <path>\nEXAMPLES\n  chmod 600 /home/elliot/id_rsa\n  chmod 4755 /usr/local/bin/backup-sync\nThe engine parses octal mode bits. 4xxx sets SUID; permission changes require root or file ownership.',
    find: 'NAME\n  find — search the current host virtual filesystem\nSYNOPSIS\n  find [path] [-name <name>] [-perm -4000]\nEXAMPLES\n  find / -name id_rsa\n  find / -perm -4000\nThe -perm -4000 predicate selects files whose owner SUID bit is set. Directory traversal permissions still apply.'
  },
  lessons: {
    recon: 'Reconnaissance is structured collection of information about assets inside an approved scope. Begin with host discovery, DNS or records, and application clues. Keep an evidence trail: each later test should follow something you observed rather than broad guessing.',
    banners: 'A service banner is a self-reported product and version string. Banners help identify candidate advisories, but they can be hidden, modified, or backported. Confirm the service through more than one safe observation when possible, then compare the exact version and configuration with primary vendor guidance.',
    'hashing-vs-encryption': 'Encryption is reversible with the correct key; hashing is designed to be one-way. Password storage normally uses a salted, deliberately expensive password hash. A wordlist audit hashes candidate words and compares results; it does not decrypt a hash. Protect recovered credentials and never test them outside authorization.',
    'suid-internals': 'On Unix-like systems, the SUID mode bit can make an executable process use the file owner effective UID. The bit does not automatically make every program exploitable. Risk appears when privileged code trusts attacker-writable inputs, scripts, environment, or paths. Inspect ownership, mode, and execution behavior; validate only in the supplied lab.',
    privesc: 'Privilege escalation assessment studies boundaries between the current identity and a more privileged one. Enumerate effective identity, sudo rules, SUID files, scheduled tasks, and writable dependencies. Explain the exact trust failure and demonstrate the minimum proof needed.',
    pivoting: 'Pivoting is controlled access from an already authorized foothold to a permitted internal segment. First inspect route and interface information, then verify that the target is in scope. Use a narrowly scoped account or key, correct private-key permissions, and document the route and evidence.',
    enumeration: 'Enumeration converts a reachable service into actionable facts: protocol, product, version, configuration, and accessible resources. Prefer targeted, low-impact checks and record both findings and uncertainty.',
    cve: 'A CVE identifier names a publicly tracked vulnerability. It does not alone establish that a host is vulnerable. Match product, version, component, configuration, and vendor fixes; use the lab module only after enumeration supports that choice.',
    'git-exposure': 'An exposed Git repository may disclose committed files, deleted secrets still present in history, and deployment details. Treat any credential as compromised, report it, and rotate it in a real environment.',
    suid: 'SUID executables run with the file owner effective UID. The important question is which data or commands the program trusts. A writable script invoked by a root-owned SUID utility is a serious trust-boundary failure in this fictional scenario.',
    hashes: 'A hash is a one-way digest, not ciphertext. Password auditing checks candidate passwords against a known hash and wordlist. Salted, slow password hashing raises the cost of guessing; use only credentials and wordlists explicitly supplied for the exercise.'
  },
  explanations: {
    nmap: { default: 'Nmap identifies hosts and services in a defined network scope.', flags: { '-sn': 'Host discovery only; it does not perform the normal port scan.', '-sV': 'Probe open ports to identify service products and versions.', '-sC': 'Run the default safe-script profile for additional enumeration.', '-p-': 'Scan all TCP port numbers rather than the common-port selection.' } },
    curl: { default: 'curl requests a URL and prints the simulated response body.', flags: { '-I': 'Request response headers only (simulated).', '-L': 'Follow redirects in tools that define redirect routes.' } },
    searchsploit: { default: 'Searches the academy local index for product and vulnerability references.' },
    exploit: { default: 'Runs a data-defined training trigger against an explicitly listed lab target.' },
    john: { default: 'Compares candidate passwords from a wordlist to the provided lab hash.' },
    ssh: { default: 'Creates a remote session after simulated account, route, and key checks.', flags: { '-i': 'Select a private-key file for public-key authentication.' } },
    chmod: { default: 'Changes virtual file permission bits using octal notation.', flags: { '600': 'Owner can read and write; group and others have no access.', '644': 'Owner can read/write; group and others can read.', '755': 'Owner can read/write/execute; group and others can read/execute.', '4755': 'SUID plus mode 755; effective UID can become the file owner during execution.' } },
    find: { default: 'Searches the virtual filesystem from the supplied path.', flags: { '-name': 'Match a basename exactly.', '-perm -4000': 'Match files with the SUID permission bit set.' } },
    ls: { default: 'Lists entries in a virtual directory.', flags: { '-a': 'Include hidden dotfiles.', '-l': 'Show mode and owner details.', '-la': 'Combine detailed output with hidden entries.' } },
    grep: { default: 'Print lines that contain a requested pattern.' },
    sudo: { default: 'Runs a permitted command with an elevated simulated identity; sudo -l lists allowed commands.', flags: { '-l': 'List commands permitted for the current account.' } }
  },
  academy: {
    steps: {
      'mission1-1': { module: 'Module 1', observation: 'web01.internal is the authorized web target.', theory: 'TCP services respond through transport-layer handshakes. Nmap version detection sends protocol-aware probes and compares responses with service signatures; -sC runs the default NSE enumeration scripts.', command: 'nmap -sV -sC 192.168.1.50', breakdown: '-sV requests service/version probes; -sC runs default NSE checks; the final argument is the in-scope target.' },
      'mission1-2': { module: 'Module 1', observation: 'The HTTP service may be serving a backup configuration.', theory: 'A web server maps URL paths to document-root files or configured aliases. A careless backup placement or access rule can expose secrets without authentication.', command: 'curl http://192.168.1.50/backup/app.conf', breakdown: 'curl makes an HTTP request; the URL specifies protocol, lab host, and exact resource path.' },
      'mission1-3': { module: 'Module 1', observation: 'The configuration reveals a SHA-256 digest and the supplied wordlist.', theory: 'SHA-256 is a one-way compression function, not reversible symmetric encryption. A dictionary audit hashes candidate words and compares digests; real password stores should use a salted, deliberately slow password KDF.', command: `john ${hash} /home/elliot/wordlist.txt`, breakdown: 'john runs the training auditor; the first argument is the recovered digest; the second is the authorized candidate list.' },
      'mission1-4': { module: 'Module 1', observation: 'The candidate password validates the backup account.', theory: 'SSH negotiates an encrypted transport, verifies the server host key, and authenticates a user. In production, verify the host-key fingerprint through a trusted channel; constrain service accounts to the access they need.', command: 'ssh backup@192.168.1.50', breakdown: 'ssh starts the client; backup is the account; the IP is the previously enumerated host.' },
      'mission1-5': { module: 'Module 2', observation: 'The www-data shell has limited privileges; SUID inventory is the next objective.', theory: 'Octal 04000 is the SUID mode bit. On exec, a process may receive the executable owner as its effective UID while retaining the invoking real UID. 2>/dev/null conventionally redirects standard error to /dev/null.', command: 'find / -perm -4000 2>/dev/null', breakdown: 'find searches from /; -perm -4000 selects SUID paths; 2>/dev/null suppresses permission diagnostics in a POSIX shell.' },
      'mission1-6': { module: 'Module 2', observation: 'The root-owned backup-sync utility depends on a www-data-owned script.', theory: 'A privileged program must not trust dependencies writable by an unprivileged identity. Verify the SUID owner, script owner, and write bit before any validation.', command: 'ls -la /usr/local/bin/backup-sync /opt/scripts/rotate.sh', breakdown: 'ls lists virtual paths; -l displays mode and ownership; -a includes dotfiles; the two operands are the utility and its script.' },
      'mission1-7': { module: 'Module 2', observation: 'rotate.sh is writable by your current www-data identity.', theory: 'This models script hijacking: a root-owned SUID utility trusts a writable dependency. The training binary interprets only the safe id marker and never launches an operating-system shell command.', command: 'echo id > /opt/scripts/rotate.sh', breakdown: 'echo emits the literal marker; > replaces the existing virtual file; the absolute path names the dependency.' },
      'mission1-8': { module: 'Module 2', observation: 'The simulator can now model the utility’s effective-root behavior.', theory: 'The SUID process can have euid 0 while its real UID remains www-data. The academy creates a simulated root shell only for this deliberately vulnerable training binary.', command: 'cd /usr/local/bin && ./backup-sync && cat /root/proof.txt', breakdown: 'cd enters the binary directory; ./ executes from cwd; && gates later commands on success; cat reads the proof.' },
      'mission2-1': { module: 'Module 3', observation: 'api01.internal exposes an Apache Tomcat service.', theory: 'A banner is a clue, not conclusive vulnerability proof: products may hide or backport versions. Match the product, version, component, and configuration.', command: 'nmap -sV -sC 192.168.1.60', breakdown: '-sV probes service versions; -sC runs default NSE enumeration; the address is the authorized API host.' },
      'mission2-2': { module: 'Module 3', observation: 'The Tomcat version and AJP evidence provide a focused research query.', theory: 'searchsploit searches a local reference catalog. A matching CVE is a lead; it does not prove the target is vulnerable.', command: 'searchsploit Tomcat 9.0.30', breakdown: 'The remaining words form the product/version query against the local catalog.' },
      'mission2-3': { module: 'Module 3', observation: 'A matching CVE exists in the training catalog.', theory: 'The exploit command is a local simulator trigger: it changes game state and sends no exploit traffic.', command: 'exploit CVE-2020-1938 192.168.1.60', breakdown: 'The first operand selects the CVE module; the second limits it to the listed lab host.' },
      'mission2-4': { module: 'Module 3', observation: 'The deploy account has a narrow sudo policy to enumerate.', theory: 'sudo evaluates grants for a particular user and command. Listing the exact rule is essential before assessing its impact.', command: 'sudo -l', breakdown: 'sudo invokes the policy query; -l lists commands granted to the current identity.' },
      'mission2-5': { module: 'Module 3', observation: 'The journal viewer is the exercise’s documented privilege boundary.', theory: 'Interactive programs sometimes expose shell escapes. This lab models only the listed sudo misconfiguration and changes virtual identity.', command: 'sudo /usr/bin/journalctl', breakdown: 'sudo requests the exact command path displayed by sudo -l.' },
      'mission2-6': { module: 'Module 3', observation: 'The API exercise grants effective root in its isolated session.', theory: 'Validate access with identity output and the smallest proof necessary.', command: 'id && cat /root/proof.txt', breakdown: 'id reports effective credentials; && gates the proof read; cat displays the objective.' },
      'mission3-1': { module: 'Module 4', observation: 'Completing the API objective adds the internal route.', theory: 'A pivot depends on an explicit route and authorized scope. ip reports simulated interface and route state without changing the real host.', command: 'ip', breakdown: 'Inspect the virtual interfaces and verify the 10.10.10.0/24 route.' },
      'mission3-2': { module: 'Module 4', observation: 'db01.secure.local is the authorized internal target.', theory: 'Enumerate internal services before selecting an authentication method.', command: 'nmap -sV 10.10.10.25', breakdown: '-sV requests version detection; the IP identifies the pivot target.' },
      'mission3-3': { module: 'Module 4', observation: 'The API host contains the training SSH key archive.', theory: 'A private key is a credential. Retrieve only the supplied lab key and protect it before use.', command: 'cat /var/backups/id_rsa', breakdown: 'cat reads the designated virtual key; the simulator copies this training artifact into Kali’s VFS.' },
      'mission3-4': { module: 'Module 4', observation: 'The recovered key must be private to its owner.', theory: 'OpenSSH rejects private keys readable by group or others. Mode 0600 grants read/write to the owner alone.', command: 'chmod 600 /home/elliot/id_rsa && ssh -i /home/elliot/id_rsa backup@10.10.10.25', breakdown: 'chmod 600 protects the key; && gates SSH; -i selects the key; backup is the remote account.' },
      'mission3-5': { module: 'Module 4', observation: 'The authenticated backup account can read the designated database objective.', theory: 'In this exercise, exfiltration means retrieving only the authorized flag file and recording its value.', command: 'cat /var/lib/postgresql/academy.flag', breakdown: 'cat reads the single simulated database flag; no real database client or external host is contacted.' }
    }
  },
  mentor: {
    'mission1-1': ['Observe: The lab range contains a web host at 192.168.1.50.', 'Theory: Host discovery narrows your work to responsive assets within the approved scope.', 'Action: Use nmap -sn 192.168.1.0/24, then record the responding host.'],
    'mission1-2': ['Observe: web01.internal exposes HTTP and SSH.', 'Theory: Exact service versions help distinguish relevant advisories from generic product matches.', 'Action: Use nmap -sV -sC -p- 192.168.1.50.'],
    'mission1-3': ['Observe: The HTTP service exposes a robots file and repository or backup paths.', 'Theory: Public web metadata and accidentally exposed deployment files can reveal useful evidence.', 'Action: Request /robots.txt, then inspect the paths it names with curl.'],
    'mission1-4': ['Observe: The backup config contains a SHA-256 digest and points to the supplied wordlist.', 'Theory: Hashing is one-way; a wordlist audit tests candidate values rather than decrypting the digest.', `Action: Run john ${hash} /home/elliot/wordlist.txt.`],
    'mission1-5': ['Observe: The recovered candidate corresponds to the backup account.', 'Theory: A foothold should be obtained with evidence-based authentication and least privilege.', 'Action: Connect to the discovered SSH service as backup and verify whoami and id.'],
    'mission1-6': ['Observe: A root-owned SUID utility invokes a script owned by www-data.', 'Theory: Privileged programs must not trust writable dependencies from less-privileged users.', 'Action: Use find / -perm -4000, inspect the utility and script with ls -la/cat, then validate the lab behavior.'],
    'mission1-7': ['Observe: The maintenance utility has a documented simulated trust-boundary flaw.', 'Theory: Confirming root access and reading a proof file creates a minimal, auditable impact demonstration.', 'Action: Execute the SUID lab binary after validating the script condition, then cat /root/proof.txt.'],
    'mission2-1': ['Observe: api01.internal exposes Tomcat on port 8080.', 'Theory: An exact banner narrows research to advisories that match the installed version and component.', 'Action: Run nmap -sV -p- 192.168.1.60 and note the Tomcat version.'],
    'mission2-2': ['Observe: The banner identifies Apache Tomcat 9.0.30 with AJP enabled.', 'Theory: Search results are leads; affected component and configuration still need to match.', 'Action: Search the local catalog for Tomcat 9.0.30 and inspect the matching CVE.'],
    'mission2-3': ['Observe: The local catalog contains a matching AJP training module.', 'Theory: Exploit validation should be scoped, minimal, and reproducible.', 'Action: Trigger the academy module with the CVE and 192.168.1.60.'],
    'mission2-4': ['Observe: The deploy shell is restricted but can enumerate sudo permissions.', 'Theory: Sudo grants are command-specific; inspect the exact rule before using it.', 'Action: Run sudo -l and compare the result with the module notes.'],
    'mission2-5': ['Observe: The allowed journal viewer has a simulated escape in this lab.', 'Theory: Demonstrate only the documented privilege boundary and verify the resulting identity.', 'Action: Use the permitted command as modeled, confirm id, then read /root/proof.txt.'],
    'mission3-1': ['Observe: Completing the API objective adds an internal route to the simulated Kali network view.', 'Theory: A pivot depends on explicit routing and target scope, not assumptions about reachability.', 'Action: Run ip and identify the 10.10.10.0/24 route.'],
    'mission3-2': ['Observe: db01.secure.local is the single authorized internal host for this module.', 'Theory: Enumerate a pivot target before authenticating so you know which service is exposed.', 'Action: Run nmap -sV 10.10.10.25.'],
    'mission3-3': ['Observe: The API host contains an archived key reference for the database account.', 'Theory: Private keys are credentials; retrieve only the lab key and protect its file mode.', 'Action: Inspect /var/backups on api01 and read the simulated id_rsa file.'],
    'mission3-4': ['Observe: The recovered private key is copied into your Kali home directory by the training console.', 'Theory: SSH refuses keys exposed to group or other users because they are authentication secrets.', 'Action: Run chmod 600 /home/elliot/id_rsa, then ssh -i /home/elliot/id_rsa backup@10.10.10.25.'],
    'mission3-5': ['Observe: The SSH session reaches the database host as the scoped backup account.', 'Theory: Exfiltration proof should be limited to the designated training flag.', 'Action: Read /var/lib/postgresql/academy.flag and record the result.']
  },
  irc: {
    key: 'fsociety-sim-key-v1',
    messages: [
      '[encrypted] Darlene: Module 1 is about following evidence: scope, service versions, web paths, then a supplied hash and wordlist.',
      '[encrypted] Mobley: On web01, there are two learning stages. The SSH foothold is not root; inspect how the maintenance utility trusts its script.',
      '[encrypted] Darlene: api01 is a separate host. Match Tomcat and AJP evidence to the local advisory before using the simulator trigger.',
      '[encrypted] Mobley: The secure database is reachable only after the API objective unlocks the route. Protect the recovered key with mode 600.',
      '[encrypted] Darlene: Keep every action inside these fictional hosts and report only the designated proof or database flag.'
    ]
  }
};
