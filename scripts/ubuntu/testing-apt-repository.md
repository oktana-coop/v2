# Testing the APT Repository

**Don't publish test releases. Test the scripts locally with Docker instead.** Every published release uploads to the live repository at `https://apt.v2editor.com`, replacing the current version for every user.

## Locally

Export the repository's GPG key to the repo root first, and **never commit `private.key`**:

```bash
gpg --armor --export 10FD019ED4E2C91F > public.key
gpg --armor --export-secret-keys 10FD019ED4E2C91F > private.key
```

Then generate the repository and install from it:

```bash
./scripts/ubuntu/test-local.sh    # generates and signs the repository in apt-repo/
./scripts/ubuntu/test-install.sh  # serves apt-repo/ and checks that apt can install from it
```

Remove `apt-repo/`, `public.key` and `private.key` when you're done.

## Live Repository

After a release, install v2 on Ubuntu with the commands in the [Linux installation docs](../../docs/install-linux.md#ubuntudebian).
