# Contributing

Thanks for helping improve **Learn Ethical Hacking with Elliot**. We welcome bug fixes, clearer lessons, accessibility improvements, and new fictional lab content. Keep all exercises safe, scoped, and understandable to learners who are new to Linux.

## Development setup

1. Fork the repository and clone your fork.
2. Use Node.js 18 or newer; the project has no external dependencies and needs no `npm install`.
3. Run the application with `node main.js`.
4. Verify edits with `node --check engine.js`, `node --check worldData.js`, and `node --check main.js`. For behavior changes, manually walk through the affected mission and confirm normal, denied, and out-of-order actions behave as intended.

Please include the commands used to validate a behavior change in your pull request. Do not include real credentials, live targets, exploit payloads, or private network details.

## Adding a data-defined module

Training content belongs in `worldData.js`. The main sections are `network`, `missions`, `man`, `lessons`, `explanations`, `academy.steps`, and `mentor`.

### Target host schema

Add a host entry under `world.network`, keyed by its simulated IP. Keep every service and file fictional and local to the simulator.

```js
'192.168.1.70': {
  hostname: 'training01.internal',
  domain: 'training01.internal',
  os: 'Ubuntu Linux',
  modules: ['module5'],
  ports: {
    '22': {
      service: 'ssh',
      banner: 'OpenSSH 9.0 (simulated)',
      scripts: 'ssh-hostkey: simulated fingerprint'
    }
  },
  routes: {},
  users: {
    learner: { password: 'fictional-lab-only' }
  },
  filesystem: {
    '/': { type: 'dir', content: '', owner: 'root', group: 'root', mode: '755' },
    '/home': { type: 'dir', content: '', owner: 'root', group: 'root', mode: '755' },
    '/home/learner': { type: 'dir', content: '', owner: 'learner', group: 'learner', mode: '750' },
    '/home/learner/notes.txt': {
      type: 'file', content: 'Fictional training note.',
      owner: 'learner', group: 'learner', mode: '640'
    }
  }
}
```

Each VFS entry is keyed by its absolute POSIX path and uses `type` (`dir` or `file`), `content`, `owner`, `group`, and an octal string `mode`. Include parent directories. Add service data under `ports`; each port maps to a `service`, exact simulated `banner`, and optional `scripts` result.

### Mission and instruction schema

Add a mission object to `world.missions`:

```js
{
  id: 'mission5',
  modules: ['module5'],
  title: 'Training Module: Evidence-led Enumeration',
  target: '192.168.1.70',
  objective: 'State the authorized learning objective.',
  steps: ['Enumerate the service', 'Inspect the supplied evidence']
}
```

For proactive feedback, add one `world.academy.steps` entry per step, using the key `<mission-id>-<one-based-step-number>` and this shape:

```js
'mission5-1': {
  module: 'Module 5',
  observation: 'What evidence should the learner notice?',
  theory: 'Explain the actual protocol or operating-system mechanism.',
  command: 'nmap -sV 192.168.1.70',
  breakdown: '-sV requests version probes; the address is the in-scope lab target.'
}
```

Add matching `world.mentor` guidance as an array of three strings (observation, theory, action), and add relevant `world.man`, `world.lessons`, and `world.explanations` entries where helpful. Keep commands consistent with the virtual host data.

**Progression note:** The current `engine.js` contains explicit mission IDs, action markers, and state transitions for the supplied four modules. Adding a new mission record and lesson text alone does not create new mechanics or unlock rules. If a level needs new state changes, access checks, or completion conditions, update the engine deliberately and document the new marker/transition alongside the data. Do not imply that a simulated exploit runs against a real service.

## Pull request guidelines

- Keep code in ES modules and use Node.js built-in modules only.
- Prefer small, readable changes that preserve the separation between engine behavior and world data.
- Explain the learner-facing **why**, not only the command syntax. Use a welcoming beginner-friendly tone and preserve the fictional *Mr. Robot* atmosphere without copying copyrighted dialogue.
- Keep mission scope explicit; never introduce live targets or real exploit execution.
- Include a concise summary, validation steps, and any known limitations in the pull request description.
- Avoid unrelated formatting churn. Check that all three JavaScript files parse before submitting.
