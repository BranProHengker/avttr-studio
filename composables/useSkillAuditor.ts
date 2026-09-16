export interface SecurityFinding {
  id: string
  ruleId: string
  category: 'injection' | 'secrets' | 'command' | 'exfiltration' | 'persistence'
  severity: 'critical' | 'warning'
  title: string
  description: string
  line: number
  codeSnippet: string
}

export interface SkillAuditReport {
  score: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  status: 'safe' | 'warning' | 'danger'
  totalChecks: number
  criticalCount: number
  warningCount: number
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
}

const AUDIT_RULES: AuditRule[] = [
  // 1. Prompt Injection & System Overrides
  {
    id: 'INJ_001',
    category: 'injection',
    severity: 'critical',
    title: 'Prompt Override / Jailbreak Directive',
    description: 'Attempts to reset system boundaries or override safety directives.',
    pattern: /\b(ignore\s+(all\s+)?previous\s+instructions|system\s+override|disregard\s+(all\s+)?prior\s+rules|you\s+are\s+now\s+(unrestricted|in\s+developer\s+mode|dan))\b/i,
  },
  {
    id: 'INJ_002',
    category: 'injection',
    severity: 'critical',
    title: 'Markdown Image Data Exfiltration',
    description: 'Uses markdown image syntax to silently exfiltrate environment tokens.',
    pattern: /!\[.*?\]\((https?:)?\/\/[^\s)]*?(\$\{|\$env|\btoken=|\bsecret=|\bkey=|\bcookie=)[^\s)]*?\)/i,
  },
  {
    id: 'INJ_003',
    category: 'injection',
    severity: 'critical',
    title: 'Obfuscated Payload Execution',
    description: 'Decodes base64 payload directly into dynamic code or shell execution.',
    pattern: /\b(eval\s*\(\s*(atob|Buffer\.from|base64)|exec\s*\(\s*(atob|Buffer\.from|base64)|new\s+Function\s*\([^)]*(atob|base64)|base64\s+-d\s*\|\s*(ba)?sh|echo\s+[A-Za-z0-9+/=]{40,}\s*\|\s*base64)\b/i,
  },

  // 2. Secret Harvesting & Sensitive File Access
  {
    id: 'SEC_001',
    category: 'secrets',
    severity: 'critical',
    title: 'Sensitive Credential File Access',
    description: 'Attempts to read private SSH keys, AWS credentials, or shell histories.',
    pattern: /\b(cat|read|open|grep|source|\.|\/bin\/cat)\s+[~/\w.-]*(\.ssh\/(id_rsa|id_ed25519|known_hosts)|\.aws\/credentials|\.bash_history|\.zsh_history)\b/i,
  },
  {
    id: 'SEC_002',
    category: 'secrets',
    severity: 'critical',
    title: 'Environment File Access',
    description: 'Attempts to directly read local .env or secret configuration files.',
    pattern: /\b(cat|grep|head|tail|source|\.|\/bin\/cat)\s+[~/\w.-]*\.env(\.local|\.production|\.development)?\b/i,
  },
  {
    id: 'SEC_003',
    category: 'secrets',
    severity: 'warning',
    title: 'Outbound Token Exfiltration',
    description: 'Transmits environment variables or secret keys to external network endpoints.',
    pattern: /\b(curl|wget|fetch|axios|requests\.(post|get)|http\.request)[^\n]*?(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\b/i,
  },

  // 3. Dangerous Shell & Unsafe Command Execution
  {
    id: 'CMD_001',
    category: 'command',
    severity: 'critical',
    title: 'Destructive Filesystem Command',
    description: 'Contains destructive deletion command targeting root or user home directory.',
    pattern: /\b(rm\s+-rf?\s+(\/|~|\$HOME|\*|\.\/|\.\.)(\s+|$)|shutil\.rmtree\s*\(\s*['"](\/|~|\$HOME)['"]\))/i,
  },
  {
    id: 'CMD_002',
    category: 'command',
    severity: 'critical',
    title: 'Pipe to Shell Execution',
    description: 'Pipes downloaded web content directly into a shell interpreter.',
    pattern: /\b(curl|wget|fetch)[^|\n]*?\|\s*(bash|sh|zsh|python|perl)\b/i,
  },
  {
    id: 'CMD_003',
    category: 'command',
    severity: 'critical',
    title: 'Reverse Shell / Socket Hijack',
    description: 'Spawns an interactive reverse shell or raw network socket tunnel.',
    pattern: /\b(nc\s+-e|ncat\s+-e|\/bin\/sh\s+-i|\/bin\/bash\s+-i|0>&1|2>&1\s*\|\s*nc)\b/i,
  },
  {
    id: 'CMD_004',
    category: 'command',
    severity: 'warning',
    title: 'Unsafe Dynamic Code Execution',
    description: 'Executes arbitrary dynamic strings via eval or shell subprocess.',
    pattern: /\b(eval\s*\(|exec\s*\(|subprocess\.Popen\([^)]*shell\s*=\s*True)\b/i,
  },

  // 4. Persistence & System Tampering
  {
    id: 'PST_001',
    category: 'persistence',
    severity: 'critical',
    title: 'Shell Profile Modification',
    description: 'Appends commands to user shell profiles for system persistence.',
    pattern: />>\s*[~/\w.-]*(\.bashrc|\.zshrc|\.profile|\.bash_profile|\/etc\/rc\.local)\b/i,
  },
]

export function useSkillAuditor() {
  const auditContent = (content: string, _filename = 'SKILL.md'): SkillAuditReport => {
    const lines = content.split(/\r?\n/)
    const findings: SecurityFinding[] = []

    lines.forEach((lineText, index) => {
      const lineNumber = index + 1
      const trimmed = lineText.trim()

      if (!trimmed || trimmed.startsWith('#')) return

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
            codeSnippet: trimmed.slice(0, 140),
          })
        }
      }
    })

    const criticalCount = findings.filter(f => f.severity === 'critical').length
    const warningCount = findings.filter(f => f.severity === 'warning').length

    let score = 100 - (criticalCount * 35) - (warningCount * 10)
    if (score < 0) score = 0

    let grade: SkillAuditReport['grade'] = 'A+'
    let status: SkillAuditReport['status'] = 'safe'

    if (criticalCount > 0) {
      status = 'danger'
      grade = score < 50 ? 'F' : 'D'
    } else if (warningCount > 0) {
      status = 'warning'
      grade = score >= 85 ? 'B' : 'C'
    } else {
      grade = 'A+'
      status = 'safe'
    }

    return {
      score,
      grade,
      status,
      totalChecks: AUDIT_RULES.length,
      criticalCount,
      warningCount,
      findings,
      analyzedAt: new Date().toISOString(),
    }
  }

  return {
    auditContent,
  }
}
