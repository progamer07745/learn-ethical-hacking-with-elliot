# Learn Ethical Hacking with Elliot

> **“Control is an illusion. Evidence is not.”** Learn the systems beneath the terminal in a fictional, isolated cyber range inspired by the atmosphere of *Mr. Robot*.

![Node.js ES Modules](https://img.shields.io/badge/Node.js-ES%20Modules-339933?logo=node.js&logoColor=white)
![Zero dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![Open source](https://img.shields.io/badge/open%20source-community-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-informational)

**Learn Ethical Hacking with Elliot** is a terminal-based cyber range and interactive Linux lab built with Node.js and its built-in modules. Explore a virtual network, investigate realistic service and file-system clues, and get step-by-step instruction after every command. The simulator does not contact real hosts or execute real exploits.

## Why this project exists

The lab teaches the mechanisms behind security findings instead of relying on Hollywood shortcuts. Each exercise connects an observation to the underlying protocol, Linux behavior, or trust-boundary failure, then guides the learner toward a scoped next action.

- **Understand the why before the how:** Nmap-style service enumeration, HTTP resource requests, SSH authentication, hashes, and privilege boundaries come with context.
- **Verify Linux permissions:** The virtual file system models numeric identities, owner/group/other permission bits, octal modes, SUID, and effective IDs.
- **Follow evidence:** A banner is a research lead, a CVE match needs validation, and a privilege escalation finding must be demonstrated with minimal proof.
- **Learn safely:** Commands operate on data-defined virtual hosts and files. No real network scan, exploit payload, or shell command is launched.

## Architecture

The project separates simulation mechanics from its training content:

- **`engine.js`** implements the command dispatcher, virtual file system, POSIX-style permission checks, simulated network tools, mission progression, and proactive academy feedback.
- **`worldData.js`** defines the local Kali environment, target hosts, ports, VFS entries, missions, manuals, lessons, mentor text, and command explanations.
- **`main.js`** starts the Node.js `readline` interface, renders the dynamic prompt, and connects tab completion to the engine.

The content is designed to be extendable. The current engine also contains explicit progression rules for the supplied four modules; a new module that needs new state transitions may require a small engine change in addition to its world data.

## Curriculum

| Module | Target host | Core concept | Real-world takeaway |
| --- | --- | --- | --- |
| 1 · Web Recon & Credential Audit | `web01.internal` · `192.168.1.50` | Service banners, exposed backup configuration, SHA-256 candidate auditing, SSH | Treat leaked credentials as compromised; distinguish a hash audit from decryption and verify service identity. |
| 2 · SUID & Script Trust | `web01.internal` · `192.168.1.50` | SUID effective IDs and a writable script dependency | Privileged programs must not trust inputs or dependencies writable by less-privileged users. |
| 3 · CVE & Service Abuse | `api01.internal` · `192.168.1.60` | Version research, a data-defined CVE exercise, and a narrow sudo grant | A version match is not proof; validate component/configuration and inspect exact sudo policy. |
| 4 · Internal Pivot & Key Hygiene | `db01.secure.local` · `10.10.10.25` | Route discovery, SSH key mode, internal access, database flag | Pivot only through authorized routes, protect private keys, and document minimal evidence. |

The curriculum advances through `briefing`, `missions`, and the guided feedback printed after each command. Use `mentor` whenever you want the three-part observation, theory, and action prompt.

## Quickstart

Requirements: Node.js with ES module support (Node.js 18 or newer recommended).

```bash
git clone https://github.com/progamer07745/learn-ethical-hacking-with-elliot
cd learn-ethical-hacking-with-elliot
node main.js
```

There is **no `npm install` step** and no third-party runtime dependency. Start with `help`, `briefing`, or `missions`.

## Commands

### Shell and virtual filesystem

`pwd`, `whoami`, `id`, `ls [-la]`, `cd`, `cat`, `echo`, `grep`, `find`, `chmod`, `sudo -l`, `su`, `history`, and `exit` work against the simulated host. The shell also supports basic `|`, `>`, and `>>` operations. Paths include `/`, `.`, `..`, and `~`.

### Recon and lab tools

`nmap`, `curl`, `searchsploit`, `exploit`, `john`, `ssh`, and `ip` model the corresponding training workflow. Their effects are limited to the fictional range. Consult `man <tool>` for examples and options.

### Academy

| Command | Purpose |
| --- | --- |
| `mentor` | Repeats the current observation, theory, and next action. |
| `missions` | Shows module objectives and completion checklists. |
| `briefing` | Summarizes the active objective and authorized scope. |
| `learn <topic>` | Opens a short lesson such as `recon`, `suid`, or `pivoting`. |
| `man <tool>` | Shows the built-in beginner-friendly manual page. |
| `explain <command> [flag]` | Explains a command or a supported flag. |
| `irc` | Displays the fictional fsociety training narrative. |

Tab completion and readline command history are available in the interactive terminal.
Use `save` and `load` to persist and restore the simulator state in `savegame.json`.

## Roadmap & community wishlist

Contributions and thoughtful issue reports are welcome. Ideas for future work include:

- An Active Directory domain lab with safe, simulated identity and policy mechanics.
- A packet-inspection module with fictional PCAP data and Wireshark-style protocol lessons.
- A custom CTF challenge creator driven by validated world-data files.
- More beginner-friendly lessons, accessibility improvements, and localization.
- Save-game versioning and richer mission progress summaries.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Educational disclaimer

This project is an educational simulation. Its hosts, accounts, credentials, and vulnerabilities are fictional. Use security tools only on systems for which you have explicit authorization. The simulator is intentionally designed so its tool commands act on virtual data and do not perform real-world scanning or exploitation.

## License

Released under the [MIT License](LICENSE). You may use, modify, and redistribute the project under its terms.
