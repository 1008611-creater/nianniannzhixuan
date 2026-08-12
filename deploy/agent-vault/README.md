# Agent Vault deployment

This Compose service is the credential broker for automation. It never belongs in the
browser application and its management and proxy ports bind to server loopback only.

On Haikayun, deploy this directory to `/opt/niannian-agent-vault`, then create the
root-only runtime file before starting it:

```bash
install -d -m 700 /srv/kidswear-data/niannian-agent-vault/data
chown 65532:101 /srv/kidswear-data/niannian-agent-vault/data
umask 077
printf 'AGENT_VAULT_MASTER_PASSWORD=%s\n' "$(openssl rand -base64 48)" \
  > /srv/kidswear-data/niannian-agent-vault/runtime.env
docker compose up -d
```

The first owner and every credential are created in the Vault UI through a local SSH
port forward. Do not commit `runtime.env`, exported vault data, agent tokens, or any
provider credential. Each consumer receives a dedicated agent token and only service
rules it needs; no consumer is given the vault master password.
