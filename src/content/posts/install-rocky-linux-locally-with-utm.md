---
author: Vrishab
pubDatetime: 2026-10-27T15:05:00Z
modDatetime: 2026-10-27T18:20:00Z
title: Run Rocky Linux 10 on a Mac with UTM and SSH
featured: true
draft: false
tags:
  - Rocky Linux
  - UTM
  - Mac
  - SSH
  - cloud-init
description: Boot the official Rocky Linux 10 cloud image in UTM on Apple silicon or Intel, let cloud-init create your user and SSH key, and connect with ssh rocky.
---

By the end of this guide, `ssh rocky` opens a Rocky Linux 10 shell on your Mac.

Plan on about 20 minutes. Most of that is the download and the first boot.

You are finished when you can check these off:

- UTM is in Applications
- Your public key is copied
- `Rocky-10-GenericCloud.qcow2` is in `~/rocky-lab`
- `rocky-seed.iso` is in `~/rocky-lab`
- `ssh rocky` opens a shell

Already partway there?

- UTM is installed. Start at [step 2](#2-create-or-reuse-an-ssh-key).
- The public key is copied. Start at [step 3](#3-download-the-rocky-linux-10-image).
- The qcow2 is downloaded. Start at [step 4](#4-write-the-cloud-init-seed).
- The seed ISO is built. Start at [step 5](#5-create-the-utm-virtual-machine).

The setup uses three things: UTM, the official Rocky Linux 10 GenericCloud image (a pre-installed disk of about 450 MB on Apple silicon and about 520 MB on Intel), and an SSH key. On the first boot, cloud-init creates your user and trusts your key. There is no graphical installer, and the VM console is plain text.

**Lab specs:** 4 GB of memory, 2 CPU cores, 32 GB of disk. A laptop with 8 GB of RAM can run this. Close other heavy apps while the VM is on.

**Which image?** Apple silicon (M1 to M4) uses the `aarch64` image. An Intel Mac uses the `x86_64` image. Not sure which you have? Open the Apple menu and choose About This Mac.

## Table of contents

## 1. Install UTM

UTM is the app that runs the VM. Download it from [mac.getutm.app](https://mac.getutm.app), open the disk image, and drag UTM into Applications. The Mac App Store build is the same app.

You need a terminal for the rest of the guide. I use [Ghostty](https://ghostty.org), but Terminal.app works the same way:

```bash
brew install --cask ghostty
```

**You should now have:** UTM in Applications.

## 2. Create or reuse an SSH key

The cloud image has no user until the first boot. Cloud-init creates one and trusts your public key, so you can log in without a password.

Check whether you already have a key:

```bash
cat ~/.ssh/id_ed25519.pub
```

If this prints a line starting with `ssh-ed25519`, that line is your **public key**. Keep it, and skip `ssh-keygen` so you don't overwrite the key you already use.

If the file is missing, create a key. The text after `-C` is just a label, so put your own name and laptop there:

```bash
ssh-keygen -t ed25519 -C "you@your-laptop" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Press Enter to accept the default path, and set a passphrase if you want one. Copy the single line that `cat` prints. The file without `.pub` is your private key. It stays on your laptop, so never paste it into the VM.

**You should now have:** that `ssh-ed25519 ...` line copied.

## 3. Download the Rocky Linux 10 image

Create a working folder, then run the download for your Mac. Skip the other one.

```bash
mkdir -p ~/rocky-lab/cidata
cd ~/rocky-lab
```

**Apple silicon (M1, M2, M3, M4):**

```bash
curl -fL -o Rocky-10-GenericCloud.qcow2 \
  https://dl.rockylinux.org/pub/rocky/10/images/aarch64/Rocky-10-GenericCloud-Base.latest.aarch64.qcow2
```

**Intel Mac:**

```bash
curl -fL -o Rocky-10-GenericCloud.qcow2 \
  https://dl.rockylinux.org/pub/rocky/10/images/x86_64/Rocky-10-GenericCloud-Base.latest.x86_64.qcow2
```

The `latest` links always point to the newest Rocky Linux 10.x GenericCloud image, so the same steps work for later 10.x releases. Rocky also publishes an LVM variant. Use the **Base** image for this guide.

> [!NOTE]
> Match the image to your CPU. UTM can emulate the other architecture, but it is much slower. Choose **Virtualize** in UTM when the image matches your Mac.

**You should now have:** `Rocky-10-GenericCloud.qcow2` in `~/rocky-lab`.

## 4. Write the cloud-init seed

On first boot, cloud-init reads two files from a small virtual CD: `user-data` creates your account, and `meta-data` sets the hostname.

Inside `~/rocky-lab`, create `cidata/user-data`. Replace all three placeholders before you save:

- `YOUR_USERNAME` is the login you want on Rocky.
- `YOUR_PASSWORD` is the console password you choose.
- `YOUR_PUBLIC_KEY` is the full `ssh-ed25519 ...` line from step 2, on one line.

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

A few details that trip people up:

- The first line must be exactly `#cloud-config`.
- Use the same `YOUR_USERNAME` here, at the UTM console, and as `User` in your SSH config.
- `ssh_pwauth: false` means SSH accepts your key only. The password is for the UTM console.
- Because the file has no `default` user entry, cloud-init creates only your user.
- `NOPASSWD` sudo is fine for a local lab. Don't copy it to a server.

Now create `cidata/meta-data`. The `local-hostname` value must match the hostname in `user-data`:

```yaml
instance-id: rocky-10-local
local-hostname: rocky-10
```

Build a CD image whose volume name is `cidata`, because cloud-init looks for that label:

```bash
hdiutil makehybrid -o ~/rocky-lab/rocky-seed.iso ~/rocky-lab/cidata \
  -iso -joliet -default-volume-name cidata
```

**You should now have:** `rocky-seed.iso` in `~/rocky-lab`.

## 5. Create the UTM virtual machine

UTM's wizard always creates an empty disk. You will replace it with the cloud image in the next part.

1. Open UTM and choose **Create a New Virtual Machine**.
2. Choose **Virtualize**, then **Linux**.
3. On **Boot ISO Image**, continue without an installer ISO. If UTM won't continue without a file, pick `rocky-seed.iso` for now.
4. Set memory to **4096 MB** and CPU cores to **2**.
5. Set the disk size to **32 GB**. This empty disk gets replaced shortly.
6. Skip the shared directory.
7. Name the VM `rocky-10` and save it.
8. Before starting it, open the VM settings and set the network mode to **Shared Network**. This gives the VM an address your Mac can reach, usually in `192.168.64.0/24`.

### Attach the cloud image

1. In the VM settings, delete the empty drive UTM created. Delete any leftover boot ISO entry too.
2. Add a drive and **Import** `~/rocky-lab/Rocky-10-GenericCloud.qcow2`. Leave the interface on **VirtIO**.
3. Select the imported drive and set its size to **32 GB**. The downloaded image is small, and cloud-init grows the filesystem to fill the drive on first boot.
4. Add a **CD/DVD** drive and attach `~/rocky-lab/rocky-seed.iso`.

> [!WARNING]
> Before you start the VM, confirm three things: the profile is **Virtualize**, the network mode is **Shared Network**, and `rocky-seed.iso` is attached.

Save and start the VM.

The UTM window is a text console. The first boot runs cloud-init, which can take a minute. Wait until the login prompt stops moving.

**You should now have:** a login prompt that stays still.

## 6. SSH into Rocky

Log in at the UTM console as `YOUR_USERNAME` with `YOUR_PASSWORD`, then find the VM's address:

```bash
ip -4 -br addr
```

Use the address on `enp0s1`, `eth0`, or a similar interface, and ignore `127.0.0.1`. That is your `VM_IP`. With UTM Shared Network it often looks like `192.168.64.x`.

If the console is in the way, `arp -a` on your Mac can show that same `192.168.64.x` address.

Add this host entry to `~/.ssh/config` on your Mac. Set `HostName` to that address and `User` to `YOUR_USERNAME`:

```
Host rocky
  HostName VM_IP
  User YOUR_USERNAME
  IdentityFile ~/.ssh/id_ed25519
```

`IdentityFile` must be the **private** key that matches the public key you put in `user-data`. If your public key came from a different file, use that private key's path instead.

Now connect:

```bash
ssh rocky
```

Accept the host key on the first connection. A shell prompt means the VM is reachable.

> [!TIP]
> The VM's address can change after a reboot. If `ssh rocky` suddenly stops working, rerun `ip -4 -br addr` at the console and update `HostName`.

**You should now have:** a shell from `ssh rocky`.

## Troubleshooting

**SSH says "connection refused"**
Cloud-init is still running, or the seed CD is missing. Wait for the login prompt in the UTM window. Confirm `rocky-seed.iso` is attached and the network mode is **Shared Network**.

**SSH says "permission denied"**
The public key in `user-data` doesn't match the private key in `IdentityFile`, or `User` in `~/.ssh/config` differs from the username in `user-data`. Fix them so they match, change `instance-id` in `meta-data` to a new value such as `rocky-10-local-2`, rebuild the seed ISO, and boot again. Cloud-init reapplies the user when `instance-id` changes.

**The console password doesn't work**
The seed didn't load. The ISO volume name must be `cidata`, and `user-data` must sit at the top level of the CD and start with `#cloud-config`.

**The VM feels stuck or very slow**
The profile is set to Emulate, or the image architecture doesn't match your Mac. Recreate the VM with **Virtualize** and the matching image.

**The disk still looks tiny after boot**
The imported drive was left at the image's original size. Power off, set that drive to 32 GB in the UTM settings, and start the VM again.

## 7. Confirm Rocky Linux 10

Check the release:

```bash
cat /etc/os-release
```

You should see Rocky Linux and version 10. Then update the system and install a few everyday tools:

```bash
sudo dnf update -y
sudo dnf install -y vim git curl
```

`sudo` works without a password because cloud-init put your user in `wheel` with `NOPASSWD`.

**You should now have:** Rocky Linux 10. The lab is done. From here on, keep using `ssh rocky`.

<details class="fold">
<summary>Optional: install from the Minimal ISO</summary>

The cloud image is the setup I use day to day. If you would rather use the graphical installer, download the Minimal ISO for your CPU from the [Rocky Linux download page](https://rockylinux.org/download), then create the UTM VM the same way and choose the ISO on the **Boot ISO Image** screen. Keep the empty virtual disk.

In the installer:

1. At the boot menu, leave **Install Rocky Linux** highlighted and press Enter.
2. Open **Installation Destination**, select the virtual disk, leave storage on Automatic, and click **Done**.
3. Set a root password. On some Rocky 10 images this item is labeled **Root Account**.
4. Create your user and tick the administrator checkbox. The username you type here is your `YOUR_USERNAME`.
5. Click **Begin Installation**. When it finishes, shut the VM down, clear the ISO from the CD/DVD drive, and start it from the disk.

Then find the address with `ip -4 -br addr`, and set `User` and `HostName` in `~/.ssh/config` to the username you created and that address. This path has no cloud-init seed, so SSH uses the password you set in the installer unless you copy your key over with `ssh-copy-id`.

</details>

<details class="fold">
<summary>FAQ</summary>

**Can I run Rocky Linux on a Mac and SSH into it?**
Yes. Boot the Rocky Linux 10 GenericCloud image in UTM, let cloud-init set up your user and key, and connect with `ssh`.

**Does Rocky Linux 10 run on Apple silicon?**
Yes. Use the `aarch64` image and choose **Virtualize** in UTM. M1 to M4 Macs run it as a native virtual machine.

**Should UTM use Virtualize or Emulate?**
Choose **Virtualize** when the image matches your Mac (`aarch64` on Apple silicon, `x86_64` on Intel). **Emulate** runs the other architecture and is far slower.

**How much RAM does the VM need?**
4 GB is comfortable. 2 GB works for this image if memory is tight. Pair it with 2 CPU cores and a 32 GB drive.

**What should I do after the first login?**
Run `sudo dnf update -y`, confirm the release in `/etc/os-release`, and keep using `ssh rocky`.

</details>
