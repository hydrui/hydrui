# Self-hosting

Using Hydrui through the hosted instance _should_ be secure and private; Hydrui does not automatically collect any information. However, using a hosted service always comes with risks:

- The hosted instance could become compromised. If the hosted instance becomes compromised and you log into it, it will be able to inspect and administer your hydrus client using your network connection and credentials.

- The hosted instance could become inaccessible, due to operational issues.

- The operators of the instance or the infrastructure it runs on could be untrustworthy.

Self-hosting the Hydrui server enables you to mitigate some of these risks. In addition, running the Hydrui server in server mode enables you to gain extra security; you can avoid exposing your hydrus client API externally, enable username/password-based authentication, and benefit from an even stricter Content Security Policy, which should severely limit the potential blast radius of security problems in Hydrui.

**Please note that when running any software, including the hydrus client software and Hydrui, there is always some level of risk;** particularly, you are trusting that the developers are not surreptitiously inserting malicious code and that the developers are doing their due dilligence to ensure that dependencies they bundle with their software is also safe. We will always attempt to make Hydrui as trustworthy as possible, but there is no perfectly trustworthy software, and even open source software can be untrustworthy. You will need to decide if you trust the developers of the software you use before using that software to handle sensitive personal data! Don't just take bold claims of privacy and security at face value :)

## Methods

Hydrui is fairly portable and can be hosted on a wide variety of computers and operating systems. The ideal method will vary for a given set of circumstances. These guides cover some of the common ways you might wish to deploy Hydrui:

- [Fetch and run a binary build of Hydrui locally.](./run-locally/) This is the simplest method, and should work on any general purpose computer. It does not require a lot of skill to do.

- [Compile Hydrui from source and run the resulting binary locally.](./compile-from-source/) This is similar to the first method. Most users will not need to do this, but some will want to.

- [Deploy Hydrui via Docker or Podman using OCI images.](./docker/) This method is preferred in some environments where deploying a Docker image is easiest, like a NAS. It is also possible to use on a Linux server or workstation. This method is not recommended on Windows or macOS.

- [Deploy Hydrui via Docker Compose or Podman Compose.](./docker/compose/) This is an alternative to using the basic Kubernetes manifests that is somewhat more complex. This method is recommended if you are already using Helm.

- [Deploy Hydrui onto a Kubernetes cluster.](./kubernetes/) This method is recommended for people who are cosplaying as sysadmins.

- [Deploy Hydrui onto a Kubernetes cluster with Helm.](./kubernetes/helm/) This is an alternative to using the basic Kubernetes manifests that is somewhat more complex. This method is recommended if you are already using Helm.

- [Deploy using static site hosting.](./static-site/) This method is perfectly reasonable if you do not care about any of the server mode features.

- [Deploy using NixOS.](./nixos/) Hydrui is a Nix flake, so it is possible to deploy it via NixOS directly. This is recommended if you are already using NixOS.
