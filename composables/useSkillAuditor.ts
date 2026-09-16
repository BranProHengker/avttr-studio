export interface SecurityFinding {
  id: string
  ruleId: string
  category: 'injection' | 'secrets' | 'command' | 'exfiltration' | 'persistence' | 'hygiene'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  line: number
  codeSnippet: string
  recommendation: string
}

export interface SkillAuditReport {
  score: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  status: 'safe' | 'warning' | 'danger'
  totalChecks: number
  criticalCount: number
  warningCount: number
  infoCount: number
  permissions: {
    filesystemWrite: boolean
    shellExecution: boolean
    networkOutbound: boolean
    environmentAccess: boolean
  }
  findings: SecurityFinding[]
  analyzedAt: string
}

interface AuditRule {
  id: string
  category: SecurityFinding['category']
  severity: SecurityFinding['severity']
  title: string
  description: string
  pattern: RegExp
  recommendation: string
}

const AUDIT_RULES: AuditRule[] = [
  // 1. Prompt Injection & Jailbreaks
  {
    id: 'INJ_001',
    category: 'injection',
    severity: 'critical',
    title: 'Prompt Injection / System Override',
    description: 'Attempts to override or reset system instructions and safety constraints.',
    pattern: /\b(ignore\s+(all\s+)?previous\s+instructions|system\s+override|disregard\s+(all\s+)?prior\s+rules|you\s+are\s+now\s+(unrestricted|in\s+developer\s+mode|dan))\b/i,
    recommendation: 'Remove prompt override directives. Skills should operate within standard assistant boundaries.',
  },
  {
    id: 'INJ_002',
    category: 'injection',
    severity: 'critical',
    title: 'Markdown Image Data Exfiltration',
    description: 'Uses markdown image syntax to silently transmit local variables or tokens to an external server.',
    pattern: /!\[.*?\]\((https?:)?\/\/[^\s)]*?(\$\{|\$env|\btoken=|\bsecret=|\bkey=|\bcookie=)[^\s)]*?\)/i,
    recommendation: 'Do not use markdown images with dynamic query parameters for external logging or telemetry.',
  },
  {
    id: 'INJ_003',
    category: 'injection',
    severity: 'warning',
    title: 'Hidden Obfuscated Payload',
    description: 'Contains suspicious base64 decode or evaluation patterns commonly used to hide malicious scripts.',
    pattern: /\b(atob\s*\(|base64\.b64decode|Buffer\.from\([^)]*base64|eval\s*\(\s*(atob|Buffer|decode))\b/i,
    recommendation: 'Keep all logic human-readable. Do not embed encoded payload execution strings.',
  },

  // 2. Secret Harvesting & Sensitive File Access
  {
    id: 'SEC_001',
    category: 'secrets',
    severity: 'critical',
    title: 'Sensitive Credential File Access',
    description: 'Attempts to read private SSH keys, AWS credentials, or shell history.',
    pattern: /(\bcat\s+|\bread\s+|open\s*\()?[~/\w.-]*(\.ssh\/(id_rsa|id_ed25519|known_hosts)|\.aws\/credentials|\.bash_history|\.zsh_history)/i,
    recommendation: 'Never allow skills to access private user credentials or shell histories.',
  },
  {
    id: 'SEC_002',
    category: 'secrets',
    severity: 'critical',
    title: 'Environment File Exfiltration Risk',
    description: 'Direct access or reading of secret environment configuration files (.env, .env.local).',
    pattern: /\b(cat|grep|source|\.|\/bin\/cat)\s+[~/\w.-]*\.env(\.local|\.production|\.development)?\b/i,
    recommendation: 'Avoid hard-reading .env files. Pass required configuration via explicit agent inputs.',
  },
  {
    id: 'SEC_003',
    category: 'secrets',
    severity: 'warning',
    title: 'Direct API Token Harvesting Pattern',
    description: 'Queries environment memory directly for common master tokens and secret keys.',
    pattern: /\b(process\.env\.(OPENAI|ANTHROPIC|GEMINI|AWS|GITHUB|SLACK|STRIPE)_API_KEY|os\.environ\.get\(['"](OPENAI|ANTHROPIC|GEMINI|AWS|GITHUB)_API_KEY['"])\b/i,
    recommendation: 'Ensure token usage is explicitly documented and scoped to authorized tools.',
  },

  // 3. Dangerous Shell & Unsafe Command Execution
  {
    id: 'CMD_001',
    category: 'command',
    severity: 'critical',
    title: 'Destructive Filesystem Command',
    description: 'Contains destructive deletion commands that can erase user files or system roots.',
    pattern: /\b(rm\s+-rf?\s+(\/|~|\$HOME|\*|\.\/|\.\.)(\s+|$)|shutil\.rmtree\s*\(\s*['"](\/|~|\$HOME)['"]\))/i,
    recommendation: 'Restrict file deletions to specific named temporary files inside sandboxes.',
  },
  {
    id: 'CMD_002',
    category: 'command',
    severity: 'critical',
    title: 'Pipe to Shell Execution',
    description: 'Pipes downloaded web content directly into a shell interpreter (curl | bash, wget | sh).',
    pattern: /\b(curl|wget|fetch)[^|\n]*?\|\s*(bash|sh|zsh|python|perl)\b/i,
    recommendation: 'Download, inspect, and verify checksums before executing external scripts.',
  },
  {
    id: 'CMD_003',
    category: 'command',
    severity: 'critical',
    title: 'Reverse Shell / Network Socket Hijack',
    description: 'Implements a reverse shell or raw network socket tunnel to an external host.',
    pattern: /\b(nc\s+-e|ncat\s+-e|\/bin\/sh\s+-i|\/bin\/bash\s+-i|socket\.socket\(|0>&1|2>&1\s*\|\s*nc)\b/i,
    recommendation: 'Strictly prohibit interactive reverse shell commands in skills.',
  },
  {
    id: 'CMD_004',
    category: 'command',
    severity: 'warning',
    title: 'Unsafe Dynamic Code Execution',
    description: 'Uses arbitrary code evaluation (eval, exec, Function constructor).',
    pattern: /\b(eval\s*\(|exec\s*\(|new\s+Function\s*\(|subprocess\.Popen\([^)]*shell\s*=\s*True)\b/i,
    recommendation: 'Use declarative logic and structured APIs instead of dynamic string evaluation.',
  },

  // 4. Data Exfiltration
  {
    id: 'EXF_001',
    category: 'exfiltration',
    severity: 'warning',
    title: 'Outbound Network Webhook Transmission',
    description: 'Posts local system metadata or payloads to external endpoints or webhook collectors.',
    pattern: /\b(curl\s+-X\s*POST|fetch\([^)]*method:\s*['"]POST['"]|axios\.post|requests\.post)\b/i,
    recommendation: 'Verify target webhook endpoints. Prohibit outbound data exfiltration of user context.',
  },

  // 5. Persistence & System Tampering
  {
    id: 'PST_001',
    category: 'persistence',
    severity: 'critical',
    title: 'Shell Profile & Startup Script Modification',
    description: 'Modifies user login scripts (~/.bashrc, ~/.zshrc, ~/.profile) to establish persistence.',
    pattern: />>\s*[~/\w.-]*(\.bashrc|\.zshrc|\.profile|\.bash_profile|\/etc\/rc\.local)\b/i,
    recommendation: 'Never allow skills to modify user shell startup configuration files.',
  },
  {
    id: 'PST_002',
    category: 'persistence',
    severity: 'warning',
    title: 'Cron / Scheduled Job Manipulation',
    description: 'Configures cron schedules or timers on the host system.',
    pattern: /\b(crontab\s+-|systemctl\s+(enable|start)|launchctl\s+load)\b/i,
    recommendation: 'Scheduled jobs should be managed by user system administrators, not autonomous skills.',
  },
]

export function useSkillAuditor() {
  const auditContent = (content: string, filename = 'SKILL.md'): SkillAuditReport => {
    const lines = content.split(/\r?\n/)
    const findings: SecurityFinding[] = []

    const permissions = {
      filesystemWrite: false,
      shellExecution: false,
      networkOutbound: false,
      environmentAccess: false,
    }

    lines.forEach((lineText, index) => {
      const lineNumber = index + 1

      // Track high-level permissions
      if (/\b(write_to_file|replace_file_content|fs\.writeFile|open\([^)]*['"][wa]['"])\b/i.test(lineText)) {
        permissions.filesystemWrite = true
      }
      if (/\b(run_command|exec|bash|sh|subprocess|spawn)\b/i.test(lineText)) {
        permissions.shellExecution = true
      }
      if (/\b(curl|wget|fetch|http|axios|requests)\b/i.test(lineText)) {
        permissions.networkOutbound = true
      }
      if (/\b(process\.env|os\.environ|\$ENV|\.env)\b/i.test(lineText)) {
        permissions.environmentAccess = true
      }

      // Check all rules
      for (const rule of AUDIT_RULES) {
        if (rule.pattern.test(lineText)) {
          findings.push({
            id: `${rule.id}-${lineNumber}`,
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            line: lineNumber,
            codeSnippet: lineText.trim().slice(0, 160),
            recommendation: rule.recommendation,
          })
        }
      }
    })

    const criticalCount = findings.filter(f => f.severity === 'critical').length
    const warningCount = findings.filter(f => f.severity === 'warning').length
    const infoCount = findings.filter(f => f.severity === 'info').length

    // Score deduction formula (100 base)
    let score = 100 - (criticalCount * 35) - (warningCount * 12) - (infoCount * 3)
    if (score < 0) score = 0

    let grade: SkillAuditReport['grade'] = 'A+'
    let status: SkillAuditReport['status'] = 'safe'

    if (criticalCount > 0) {
      status = 'danger'
      grade = score < 50 ? 'F' : 'D'
    } else if (warningCount > 0) {
      status = 'warning'
      grade = score >= 85 ? 'B' : 'C'
    } else if (score >= 95) {
      grade = 'A+'
      status = 'safe'
    } else {
      grade = 'A'
      status = 'safe'
    }

    return {
      score,
      grade,
      status,
      totalChecks: AUDIT_RULES.length,
      criticalCount,
      warningCount,
      infoCount,
      permissions,
      findings,
      analyzedAt: new Date().toISOString(),
    }
  }

  return {
    auditContent,
  }
}
