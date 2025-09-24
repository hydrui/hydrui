# Hydrui Server

A server to run Hydrui with some added security hardening. If you are worried about supply chain security or exploitable bugs in Hydrui or its dependencies, this server offers some additional defenses by greatly limiting what kinds of exfiltration is possible using Content Security Policy (CSP). It also offers a simple authentication system using the standard htpasswd file format (albeit only with bcrypt or SHA-1 hashes) which uses JWT-based session cookies. All XHR requests are same-site, so there is no CORS policy, ensuring that other websites on the Internet can't do anything interesting to the Hydrui server.

## Usage

```bash
hydrui-server --hydrus-url=http://localhost:45869
```

## Creating htpasswd Files

You can create htpasswd files using the Apache `htpasswd` utility:

```bash
# Create a new file with a user
htpasswd -B -c /path/to/htpasswd username

# Add another user to an existing file
htpasswd -B /path/to/htpasswd another_username
```
