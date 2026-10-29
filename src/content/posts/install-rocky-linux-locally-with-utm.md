---
author: Vrishab
pubDatetime: 2026-10-27T15:05:00Z
modDatetime: 2026-10-29T04:15:00Z
title: Build a Local Rocky Linux 10 Lab on macOS with UTM
featured: true
draft: false
tags:
  - Rocky Linux
  - UTM
  - macOS
  - cloud-init
description: Set up a local Rocky Linux 10 virtual machine in UTM using the official GenericCloud image and a cloud-init seed ISO.
---

Running a full ISO installer every time you want a fresh Linux VM is slow. A faster way to build a local Rocky Linux 10 lab on macOS is to boot the official **GenericCloud** image in [UTM](https://mac.getutm.app) and let `cloud-init` configure your account on first boot.

## Regular ISO vs. Cloud image

There are two ways to provision a Rocky Linux virtual machine depending on what you want to practice:

- **Regular ISO:** Best if you want to learn OS installation, disk partitioning, users, and initial system configuration.
- **Cloud image + cloud-init:** Best if you want to learn automated provisioning, infrastructure automation, and how cloud servers are initialized.

This guide uses the **cloud image + cloud-init** approach: downloading the cloud disk image, generating a local `cidata` seed ISO, configuring the UTM virtual machine, and verifying the lab environment.

## Lab specifications

| Setting      | Value                                         |
| ------------ | --------------------------------------------- |
| Hypervisor   | UTM (**Virtualize** mode)                     |
| OS image     | Rocky Linux 10 GenericCloud Base (`.qcow2`)   |
| Architecture | `aarch64` (Apple silicon) or `x86_64` (Intel) |
| CPU          | 2 cores                                       |
| Memory       | 4096 MB (4 GB)                                |
| Disk         | 32 GB (VirtIO)                                |
| Network      | Shared Network (NAT)                          |

## 1. Install UTM

Download UTM from [mac.getutm.app](https://mac.getutm.app), open the `.dmg`, and move **UTM.app** to `/Applications`.

## 2. Download the Rocky Linux 10 cloud image

Create a working directory for the lab files and the `cloud-init` configuration:

```bash
mkdir -p ~/rocky-lab/cidata
cd ~/rocky-lab
```

Download the Rocky Linux 10 GenericCloud Base image that matches your Mac's processor. Using the native architecture allows UTM to use hardware virtualization (**Virtualize**) instead of slower CPU emulation.

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

## 3. Create the cloud-init seed ISO

Cloud images ship without a default password. On the first boot, `cloud-init` looks for a volume labeled `cidata` containing two files: `user-data` and `meta-data`.

### Create `user-data`

Create `~/rocky-lab/cidata/user-data` and replace `YOUR_USERNAME` and `YOUR_PASSWORD` with the username and password you want to use inside the VM:

```yaml
#cloud-config
hostname: rocky-10
users:
  - name: YOUR_USERNAME
    gecos: Lab User
    groups: wheel
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
    plain_text_passwd: YOUR_PASSWORD
chpasswd:
  expire: false
```

Key lines in this file:

- `#cloud-config` must be the very first line so `cloud-init` parses the file as YAML configuration.
- `groups: wheel` and `sudo: ALL=(ALL) NOPASSWD:ALL` grant administrative privileges without prompting for a password inside the local lab.
- `lock_passwd: false` and `plain_text_passwd` enable console login with your password.
- `chpasswd.expire: false` prevents the VM from forcing a password change on first login.

### Create `meta-data`

Create `~/rocky-lab/cidata/meta-data` to define the instance ID and hostname:

```yaml
instance-id: rocky-10-local-1
local-hostname: rocky-10
```

### Build the `cidata` ISO

Package the `cidata` directory into a seed ISO using `hdiutil`:

```bash
hdiutil makehybrid -o ~/rocky-lab/rocky-seed.iso ~/rocky-lab/cidata \
  -iso -joliet -default-volume-name cidata
```

The `-default-volume-name cidata` flag is required—`cloud-init` will ignore the drive if the volume label is anything else.

## 4. Configure the virtual machine in UTM

UTM's creation wizard creates a blank virtual drive by default. You will create the VM shell first, then replace the blank drive with the downloaded `.qcow2` cloud image.

### Create the VM

1. Open UTM and click **Create a New Virtual Machine**.
2. Select **Virtualize**, then select **Linux**.
3. On the **Boot ISO Image** screen, check **Skip ISO boot** (or leave the boot ISO empty) and continue.
4. Set **Memory** to `4096 MB` and **CPU Cores** to `2`.
5. Accept the default storage prompt to finish the wizard (you will replace this disk in the next step).
6. Skip **Shared Directory**.
7. Name the VM `rocky-10` and click **Save**.

### Attach the cloud disk and seed ISO

Before starting the VM for the first time, right-click `rocky-10` in UTM and select **Edit**:

1. **Network:** Under **Network**, set **Network Mode** to **Shared Network**.
2. **Remove the default blank drive:** Under **Drives**, select the default VirtIO drive created by the wizard and click **Delete Drive**.
3. **Import the cloud image:** Click **New… → Import…** and select `~/rocky-lab/Rocky-10-GenericCloud.qcow2`. Keep the interface set to **VirtIO**.
4. **Resize the cloud disk:** Select the imported `.qcow2` drive and increase its **Size** to `32 GB`. `cloud-init` automatically expands the root partition and filesystem on boot.
5. **Attach the seed ISO:** Click **New…**, check **Removable**, leave the interface as **USB** or **IDE/VirtIO CD/DVD**, and click **Create**. Select the new CD/DVD drive in the VM window (or browse to it) and attach `~/rocky-lab/rocky-seed.iso`.
6. Click **Save**.

## 5. First boot and verification

Start the `rocky-10` virtual machine. A text console opens and boots Rocky Linux 10.

During the first boot, `cloud-init` runs in the background to resize the disk, set the hostname, and create your user account. Wait until the cloud-init output finishes scrolling and the `rocky-10 login:` prompt stays steady.

Log in with `YOUR_USERNAME` and `YOUR_PASSWORD`, then verify the setup:

```bash
# Check OS version
cat /etc/os-release

# Verify the root filesystem expanded to ~32 GB
df -h /

# Verify networking
ip -4 -br addr
```

Update the system packages and install common lab utilities:

```bash
sudo dnf update -y
sudo dnf install -y vim git curl tmux
```

Once the first boot has completed, you can optionally power off the VM and eject `rocky-seed.iso`.

## 6. Troubleshooting

- **Login password is rejected at the console:** `cloud-init` did not read the seed ISO. Verify that the ISO was built with `-default-volume-name cidata`, that `user-data` starts with `#cloud-config` on line 1, and that `rocky-seed.iso` was attached before the first boot.
- **Re-running `cloud-init` after editing `user-data`:** `cloud-init` only runs user creation once per `instance-id`. If you change `user-data`, increment `instance-id` in `meta-data` (for example, to `rocky-10-local-2`), rebuild `rocky-seed.iso`, and reboot the VM.
- **Root filesystem is still under 1 GB:** The `.qcow2` drive was not resized in UTM. Shut down the VM, open **Edit → Drives**, set the drive size to `32 GB`, and boot again.
- **VM boots slowly or hangs:** Make sure the VM was created with **Virtualize** (not **Emulate**) and that the downloaded `.qcow2` architecture matches your Mac (`aarch64` for Apple silicon, `x86_64` for Intel).
