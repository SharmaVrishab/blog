---
author: Vrishab
pubDatetime: 2026-10-27T15:05:00Z
modDatetime: 2026-10-28T18:55:00Z
title: Run Rocky Linux 10 on a Mac with UTM and SSH
featured: true
draft: false
tags:
  - Rocky Linux
  - UTM
  - Mac
  - SSH
  - cloud-init
description: Boot the official Rocky Linux 10 cloud image in UTM, let cloud-init create your user, and connect with ssh rocky.
---

A Mac does not run Rocky Linux on its own. UTM can. This post boots the official Rocky Linux 10 cloud image, lets cloud-init create a user on the first boot, and opens a shell with `ssh rocky`.

The path takes about 20 minutes. Most of that time is the download and the first boot. The virtual machine uses 4 GB of memory, 2 CPU cores, and a 32 GB disk. A laptop with 8 GB of RAM can run it if other heavy apps are closed.

There is no graphical installer. The window inside UTM is a text console. The shell you use after that is SSH from the Mac.

## UTM runs the machine

UTM is the app that runs the virtual machine. Download it from [mac.getutm.app](https://mac.getutm.app), open the disk image, and drag UTM into Applications. The Mac App Store build is the same app.

The rest of the guide uses a terminal. Terminal.app is enough. I use [Ghostty](https://ghostty.org):

```bash
brew install --cask ghostty
```

## The login is an SSH key

The cloud image has no user until the first boot. Cloud-init creates one and trusts your public key, so SSH does not ask for a password.

Check whether a key already exists:

```bash
cat ~/.ssh/id_ed25519.pub
```

A line that starts with `ssh-ed25519` is your public key. Keep it. Skip `ssh-keygen` so you do not overwrite a key you already use.

If the file is missing, create one. The text after `-C` is only a label:

```bash
ssh-keygen -t ed25519 -C "you@your-laptop" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Press Enter to accept the default path, and set a passphrase if you want one. Copy the single line that `cat` prints. The file without `.pub` is the private key. It stays on the Mac.

## The image has to match the Mac

Apple silicon, from M1 through M4, uses the `aarch64` image. An Intel Mac uses the `x86_64` image. About This Mac, in the Apple menu, shows which one you have.

UTM can emulate the other architecture, but that path is much slower. When the image matches the Mac, choose **Virtualize**.

Create a working folder, then download only the image for your Mac:

```bash
mkdir -p ~/rocky-lab/cidata
cd ~/rocky-lab
```

Apple silicon:

```bash
curl -fL -o Rocky-10-GenericCloud.qcow2 \
  https://dl.rockylinux.org/pub/rocky/10/images/aarch64/Rocky-10-GenericCloud-Base.latest.aarch64.qcow2
```

Intel:

```bash
curl -fL -o Rocky-10-GenericCloud.qcow2 \
  https://dl.rockylinux.org/pub/rocky/10/images/x86_64/Rocky-10-GenericCloud-Base.latest.x86_64.qcow2
```

Those `latest` links point at the current Rocky Linux 10.x GenericCloud image, so the same steps hold for later 10.x releases. Rocky also publishes an LVM variant. This guide uses the Base image. On Apple silicon that disk is about 450 MB. On Intel it is about 520 MB.

## Cloud-init creates the account

On the first boot, cloud-init reads two files from a small virtual CD. `user-data` creates the account. `meta-data` sets the hostname.

Inside `~/rocky-lab`, create `cidata/user-data`. Replace the three placeholders before you save. `YOUR_USERNAME` is the login on Rocky. `YOUR_PASSWORD` is the console password. `YOUR_PUBLIC_KEY` is the full `ssh-ed25519` line, on one line.

```yaml
#cloud-config
hostname: rocky-10
users:
  - name: YOUR_USERNAME
    gecos: Your Name
    groups: wheel
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
    plain_text_passwd: YOUR_PASSWORD
    ssh_authorized_keys:
      - YOUR_PUBLIC_KEY
ssh_pwauth: false
```

A few details decide whether the first boot works.

The first line has to be exactly `#cloud-config`. Use the same username here, at the UTM console, and as `User` in the SSH config. `ssh_pwauth: false` means SSH accepts the key only. The password is for the console. With no `default` user entry, cloud-init creates only your user. `NOPASSWD` sudo is fine on a local lab. Leave it off a real server.

Then create `cidata/meta-data`. `local-hostname` has to match the hostname in `user-data`:

```yaml
instance-id: rocky-10-local
local-hostname: rocky-10
```

Cloud-init looks for a CD whose volume name is `cidata`:

```bash
hdiutil makehybrid -o ~/rocky-lab/rocky-seed.iso ~/rocky-lab/cidata \
  -iso -joliet -default-volume-name cidata
```

## The empty disk gets replaced

UTM's wizard always creates an empty disk. Replace it with the cloud image before the first start.

1. Open UTM and choose **Create a New Virtual Machine**.
2. Choose **Virtualize**, then **Linux**.
3. On **Boot ISO Image**, continue without an installer ISO. If UTM will not continue without a file, pick `rocky-seed.iso` for now.
4. Set memory to **4096 MB** and CPU cores to **2**.
5. Set the disk size to **32 GB**. This empty disk is replaced in a moment.
6. Skip the shared directory.
7. Name the VM `rocky-10` and save it.
8. Before starting it, open the VM settings and set the network mode to **Shared Network**. The VM then gets an address the Mac can reach, usually in `192.168.64.0/24`.

In the VM settings, delete the empty drive UTM created, and delete any leftover boot ISO entry. Add a drive and **Import** `~/rocky-lab/Rocky-10-GenericCloud.qcow2`. Leave the interface on **VirtIO**. Select that drive and set its size to **32 GB**. The downloaded image is small, and cloud-init grows the filesystem to fill the drive on first boot. Add a **CD/DVD** drive and attach `~/rocky-lab/rocky-seed.iso`.

Three settings have to be true before the VM starts: the profile is **Virtualize**, the network mode is **Shared Network**, and `rocky-seed.iso` is attached.

Save and start the VM. The first boot runs cloud-init, which can take a minute. Wait until the login prompt stops moving.

## SSH is the way in

Log in at the UTM console with the username and password from `user-data`, then find the address:

```bash
ip -4 -br addr
```

Use the address on `enp0s1`, `eth0`, or a similar interface. Ignore `127.0.0.1`. With Shared Network it often looks like `192.168.64.x`. If the console is in the way, `arp -a` on the Mac can show that same address.

Add a host entry to `~/.ssh/config`. Set `HostName` to that address and `User` to the Rocky username:

```
Host rocky
  HostName VM_IP
  User YOUR_USERNAME
  IdentityFile ~/.ssh/id_ed25519
```

`IdentityFile` has to be the private key that matches the public key in `user-data`. If that public key came from a different file, use that private key's path.

```bash
ssh rocky
```

Accept the host key on the first connection. A shell prompt means the VM is reachable.

The address can change after a reboot. If `ssh rocky` stops working, run `ip -4 -br addr` at the console again and update `HostName`.

## When the connection fails

**Connection refused.** Cloud-init is still running, or the seed CD is missing. Wait for the login prompt. Confirm that `rocky-seed.iso` is attached and the network mode is **Shared Network**.

**Permission denied.** The public key in `user-data` does not match the private key in `IdentityFile`, or `User` in `~/.ssh/config` differs from the username in `user-data`. Make them match, change `instance-id` in `meta-data` to a new value such as `rocky-10-local-2`, rebuild the seed ISO, and boot again. Cloud-init reapplies the user when `instance-id` changes.

**The console password does not work.** The seed did not load. The ISO volume name has to be `cidata`, and `user-data` has to sit at the top of the CD and start with `#cloud-config`.

**The VM is slow or seems stuck.** The profile is set to Emulate, or the image does not match the Mac. Recreate the VM with **Virtualize** and the matching image.

**The disk still looks small.** The imported drive was left at the image's original size. Power off, set that drive to 32 GB, and start the VM again.

## What you should see

Check the release:

```bash
cat /etc/os-release
```

The file should name Rocky Linux and version 10. Then update the system and install a few everyday tools:

```bash
sudo dnf update -y
sudo dnf install -y vim git curl
```

`sudo` works without a password because cloud-init put the user in `wheel` with `NOPASSWD`.

From here, `ssh rocky` is the shell. The cloud image is the path this guide uses, because the account and the key are already in place on first boot.

The other route is the graphical installer. Download the Minimal ISO for your CPU from the [Rocky Linux download page](https://rockylinux.org/download), create the VM the same way, and choose that ISO on the **Boot ISO Image** screen. Keep the empty virtual disk. In the installer, select the disk with automatic storage, set a root password, create your user as an administrator, and begin the installation. When it finishes, shut the VM down, clear the ISO, and start from the disk. That path has no cloud-init seed, so SSH uses the installer password unless you copy a key over with `ssh-copy-id`.
