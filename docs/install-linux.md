# Installing v2 on Linux

## Ubuntu/Debian

Install v2 from the APT repository (amd64 and arm64) to get updates along with your system updates:

```sh
wget -qO- https://apt.v2editor.com/public.key | sudo gpg --yes --dearmor -o /usr/share/keyrings/v2-archive-keyring.gpg
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/v2-archive-keyring.gpg] https://apt.v2editor.com stable main" | sudo tee /etc/apt/sources.list.d/v2.list
sudo apt update && sudo apt install v2
```

To update:

```sh
sudo apt update && sudo apt upgrade
```

To uninstall v2 and remove the repository:

```sh
sudo apt remove v2
sudo rm /etc/apt/sources.list.d/v2.list /usr/share/keyrings/v2-archive-keyring.gpg
sudo apt update
```
