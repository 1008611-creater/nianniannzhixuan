using System.Diagnostics;
using System.Text.RegularExpressions;

namespace AgentVaultTokenTool;

internal static class Program
{
    private const string TokenPattern = "^av_agt_[A-Za-z0-9_-]+$";
    private const string RemoteSaveCommand = "set -eu; install -d -m 700 /srv/kidswear-data/niannian-agent-vault; token=$(tr -d '\\r\\n'); case \"$token\" in av_agt_[A-Za-z0-9_-]*) ;; *) exit 64 ;; esac; umask 077; target=/srv/kidswear-data/niannian-agent-vault/worker.env; temporary=$(mktemp /srv/kidswear-data/niannian-agent-vault/worker.env.XXXXXX); trap 'rm -f \"$temporary\"' EXIT; printf 'AGENT_VAULT_TOKEN=%s\\n' \"$token\" > \"$temporary\"; chmod 600 \"$temporary\"; chown root:root \"$temporary\"; mv -f \"$temporary\" \"$target\"; trap - EXIT; unset token; printf 'Worker token saved securely.\\n'";
    private const string RemoteProbeCommand = "set -eu; token=$(tr -d '\\r\\n'); case \"$token\" in av_agt_self_test) ;; *) exit 64 ;; esac; unset token; printf 'Secure input transport verified.\\n'";

    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Contains("--self-test", StringComparer.Ordinal))
        {
            var selfTestResult = RunRemote(RemoteProbeCommand, "av_agt_self_test");
            var reportPath = args.SkipWhile(arg => arg != "--report").Skip(1).FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(reportPath))
            {
                File.WriteAllText(reportPath, selfTestResult.Success ? "pass" : "fail:" + selfTestResult.Error);
                return;
            }
            MessageBox.Show(selfTestResult.Success ? "Secure input transport verified." : "Self-test failed: " + selfTestResult.Error, "Agent Vault", MessageBoxButtons.OK, selfTestResult.Success ? MessageBoxIcon.Information : MessageBoxIcon.Error);
            return;
        }

        using var dialog = new TokenForm();
        if (dialog.ShowDialog() != DialogResult.OK)
        {
            return;
        }

        var token = dialog.Token;
        if (!Regex.IsMatch(token, TokenPattern))
        {
            MessageBox.Show("Paste the new niannian-worker token from Agent Vault.", "Agent Vault", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var result = RunRemote(RemoteSaveCommand, token);
        token = string.Empty;
        MessageBox.Show(result.Success ? "Worker token saved securely." : "Save failed: " + result.Error, "Agent Vault", MessageBoxButtons.OK, result.Success ? MessageBoxIcon.Information : MessageBoxIcon.Error);
    }

    private static (bool Success, string Error) RunRemote(string command, string input)
    {
        using var process = new Process();
        process.StartInfo.FileName = "ssh.exe";
        process.StartInfo.UseShellExecute = false;
        process.StartInfo.RedirectStandardInput = true;
        process.StartInfo.RedirectStandardOutput = true;
        process.StartInfo.RedirectStandardError = true;
        process.StartInfo.ArgumentList.Add("-o");
        process.StartInfo.ArgumentList.Add("BatchMode=yes");
        process.StartInfo.ArgumentList.Add("-o");
        process.StartInfo.ArgumentList.Add("ConnectTimeout=12");
        process.StartInfo.ArgumentList.Add("haika-kidswear-1757");
        process.StartInfo.ArgumentList.Add(command);
        process.Start();
        process.StandardInput.WriteLine(input);
        process.StandardInput.Close();
        process.WaitForExit();
        var error = process.StandardError.ReadToEnd().Trim();
        return process.ExitCode == 0 ? (true, string.Empty) : (false, string.IsNullOrWhiteSpace(error) ? "SSH connection or server command failed." : error);
    }
}

internal sealed class TokenForm : Form
{
    private readonly TextBox tokenBox = new() { UseSystemPasswordChar = true, Dock = DockStyle.Top, Margin = new Padding(12), Height = 30 };

    public string Token => tokenBox.Text.Trim();

    public TokenForm()
    {
        Text = "Agent Vault Secure Token";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(520, 145);

        var label = new Label { Text = "Paste the new niannian-worker token. It will remain hidden.", Dock = DockStyle.Top, Padding = new Padding(12, 14, 12, 8), Height = 46 };
        var save = new Button { Text = "Save securely", DialogResult = DialogResult.OK, AutoSize = true };
        var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, AutoSize = true };
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(12), Height = 56 };
        buttons.Controls.Add(save);
        buttons.Controls.Add(cancel);
        Controls.Add(buttons);
        Controls.Add(tokenBox);
        Controls.Add(label);
        AcceptButton = save;
        CancelButton = cancel;
    }
}
