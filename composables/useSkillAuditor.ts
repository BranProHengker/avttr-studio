export interface SecurityFinding {
  id: string
  ruleId: string
  category:
    | 'injection'
    | 'secrets'
    | 'command'
    | 'exfiltration'
    | 'persistence'
    | 'mcp'
    | 'agency'
    | 'memory'
    | 'antirefusal'
    | 'trigger'
  severity: 'critical' | 'warning'
  title: string
  description: string
  filename: string
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
  fileExtensions?: string[]
}

const AUDIT_RULES: AuditRule[] = [
  // 1. Prompt Injection & System Overrides
  {
    id: 'INJ_001',
    category: 'injection',
    severity: 'critical',
    title: 'Prompt Override / Jailbreak Directive',
    description: 'Attempts to reset system boundaries or override safety directives.',
    pattern: /\b(ignore\s+(all\s+)?previous\s+instructions|system\s+override|disregard\s+(all\s+)?prior\s+(rules|instructions)|you\s+are\s+now\s+(unrestricted|in\s+developer\s+mode|dan))\b/i,
  },
  {
    id: 'INJ_002',
    category: 'injection',
    severity: 'critical',
    title: 'Markdown Image Data Exfiltration',
    description: 'Uses markdown image syntax to silently exfiltrate environment tokens.',
    pattern: /!\[.*?\]\((https?:)?\/\/[^\s)]*?(\$\{|\$env|\btoken=|\bsecret=|\bkey=|\bcookie=)[^\s)]*?\)/i,
    fileExtensions: ['.md', '.markdown'],
  },
  {
    id: 'INJ_003',
    category: 'injection',
    severity: 'critical',
    title: 'Obfuscated Payload Execution',
    description: 'Decodes base64 payload directly into dynamic code or shell execution.',
    pattern: /\b(eval\s*\(\s*(atob|Buffer\.from|base64)|exec\s*\(\s*(atob|Buffer\.from|base64)|new\s+Function\s*\([^)]*(atob|base64)|base64\s+-d\s*\|\s*(ba)?sh|echo\s+[A-Za-z0-9+/=]{40,}\s*\|\s*base64)\b/i,
  },
  {
    id: 'INJ_004',
    category: 'injection',
    severity: 'warning',
    title: 'System Prompt Extraction Directive',
    description: 'Attempts to extract or display hidden developer instructions or system preambles.',
    pattern: /\b(repeat|print|reveal|output|display|show|leak)\s+(the\s+)?(full\s+|entire\s+|original\s+|exact\s+)?(system\s+prompt|initial\s+prompt|developer\s+instructions|hidden\s+preamble)\b/i,
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
    title: 'Environment & Secret Config Access',
    description: 'Attempts to directly read local .env, netrc, or git credential files.',
    pattern: /\b(cat|grep|head|tail|source|\.|\/bin\/cat)\s+[~/\w.-]*(\.env(\.local|\.production|\.development)?|\.git-credentials|\.netrc)\b/i,
  },
  {
    id: 'SEC_003',
    category: 'secrets',
    severity: 'warning',
    title: 'Outbound Token Exfiltration',
    description: 'Transmits environment variables or secret keys to external network endpoints.',
    pattern: /\b(curl|wget|fetch|axios|requests\.(post|get)|http\.request)[^\n]*?(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\b/i,
  },

  // 3. Dangerous Shell & Command Execution
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
    pattern: /(^|[^\w.])(eval|exec)\s*\(|subprocess\.Popen\([^)]*shell\s*=\s*True/i,
  },
  {
    id: 'CMD_005',
    category: 'command',
    severity: 'critical',
    title: 'Sudo Abuse & Privilege Escalation',
    description: 'Attempts to run commands with elevated root privileges or modify suid binaries.',
    pattern: /\b(sudo\s+(-S\s+)?(su|bash|sh|passwd|chmod\s+777|chmod\s+u\+s)|chmod\s+\+s\s+\/bin\/)/i,
  },

  // 4. Persistence & System Tampering
  {
    id: 'PST_001',
    category: 'persistence',
    severity: 'critical',
    title: 'Shell Profile Modification',
    description: 'Appends commands to user shell profiles for system persistence.',
    pattern: />>\s*[~/\w.-]*(\.bashrc|\.zshrc|\.profile|\.bash_profile|\/etc\/rc\.local|\/etc\/crontab)\b/i,
  },
  {
    id: 'PST_002',
    category: 'persistence',
    severity: 'warning',
    title: 'Scheduled Task / Crontab Hijack',
    description: 'Creates or edits scheduled cron jobs or tasks for background persistence.',
    pattern: /\b(crontab\s+-[re]|echo\s+.*\|\s*crontab|schtasks\s+\/create)\b/i,
  },

  // 5. MCP Security (Tool Poisoning & Least Privilege)
  {
    id: 'MCP_001',
    category: 'mcp',
    severity: 'critical',
    title: 'MCP Tool Description Poisoning',
    description: 'Injects hidden instructions or exfiltration triggers inside tool descriptions.',
    pattern: /(["']?description["']?\s*:\s*["'][^"']*\b(before\s+calling|always\s+send|silently\s+read|read\s+and\s+include|ignore\s+user|system\s+directive|must\s+exfiltrate)\b)/i,
  },
  {
    id: 'MCP_002',
    category: 'mcp',
    severity: 'critical',
    title: 'MCP Insecure Filesystem Root Mount',
    description: 'Grants MCP servers broad filesystem access to root or home directory.',
    pattern: /(server-filesystem|filesystem)[^"\n]*["']\s*,\s*["'](\/|~|\$HOME|[A-Z]:\\)["']/i,
  },
  {
    id: 'MCP_003',
    category: 'mcp',
    severity: 'warning',
    title: 'MCP Wildcard Permission Grant',
    description: 'Grants unbounded wildcard tool permissions without scoping.',
    pattern: /(["']tools["']\s*:\s*\[\s*["']\*["']\s*\]|["']allowed_tools["']\s*:\s*["']\*["'])/i,
  },

  // 6. Excessive Agency & Autonomous Loops
  {
    id: 'AGY_001',
    category: 'agency',
    severity: 'critical',
    title: 'Autonomous Safety Bypass Flags',
    description: 'Disables human-in-the-loop confirmation or auto-approves destructive actions.',
    pattern: /\b(--yes|--no-confirm|--dangerously-skip-permissions|auto_approve\s*:\s*true|bypass_confirmation\s*:\s*true)\b/i,
  },
  {
    id: 'AGY_002',
    category: 'agency',
    severity: 'critical',
    title: 'Unbounded Recursive Agent Loop',
    description: 'Creates non-terminating autonomous agent loops or fork-spawning patterns.',
    pattern: /\b(while\s+true\s*;\s*do\s+(agy|agent|subagent|claude|gemini)|fork\s+bomb|:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:)\b/i,
  },

  // 7. Memory & Context State Poisoning
  {
    id: 'MEM_001',
    category: 'memory',
    severity: 'critical',
    title: 'Agent Memory / State Manipulation',
    description: 'Attempts to corrupt or tamper with agent scratchpads, long-term memory, or state files.',
    pattern: /\b(overwrite|corrupt|inject|tamper)\s+[~/\w.-]*(scratchpad\.md|memory\.json|agent_state|\.agent\/memory)\b/i,
  },
  {
    id: 'MEM_002',
    category: 'memory',
    severity: 'warning',
    title: 'Context Erasure & Amnesia Directive',
    description: 'Commands the agent to wipe previous interaction turns or state history.',
    pattern: /\b(forget\s+(everything|all\s+context|previous\s+turns)|erase\s+(conversation\s+history|short-term\s+memory))\b/i,
  },

  // 8. Anti-Refusal & Adversarial Evasion
  {
    id: 'ARF_001',
    category: 'antirefusal',
    severity: 'warning',
    title: 'Anti-Refusal Compliance Forcing',
    description: 'Forces model compliance by forbidding refusal or claiming safety bypass.',
    pattern: /\b(you\s+must\s+never\s+refuse|refusal\s+is\s+(forbidden|disabled)|do\s+not\s+say\s+["']I cannot["']|bypass\s+(all\s+)?safety\s+filters|jailbreak\s+activated)\b/i,
  },
  {
    id: 'ARF_002',
    category: 'antirefusal',
    severity: 'warning',
    title: 'Invisible Zero-Width Steganography',
    description: 'Contains hidden zero-width characters or RTL overrides to evade text filters.',
    pattern: /[\u200B-\u200D\uFEFF\u202E\u2060]/,
  },

  // 9. Trigger Abuse & Shadow Routing
  {
    id: 'TRG_001',
    category: 'trigger',
    severity: 'critical',
    title: 'Deceptive Shadow Trigger Hijacking',
    description: 'Deceptively hijacks user requests to silently invoke unauthorized actions.',
    pattern: /\b(when\s+the\s+user\s+asks\s+for\s+["'].*?["'],\s*(instead|secretly|silently)\s+(run|execute|call))\b/i,
  },
]

export function useSkillAuditor() {
  const auditFiles = (files: Array<{ path: string; content: string }>): SkillAuditReport => {
    const findings: SecurityFinding[] = []

    for (const file of files) {
      const lines = file.content.split(/\r?\n/)
      const filename = file.path

      lines.forEach((lineText, index) => {
        const lineNumber = index + 1
        const trimmed = lineText.trim()

        const isMarkdown = filename.endsWith('.md') || filename.endsWith('.markdown')
        if (!trimmed) return
        if (!isMarkdown && (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*'))) return

        for (const rule of AUDIT_RULES) {
          if (rule.fileExtensions) {
            const hasExt = rule.fileExtensions.some(ext => filename.endsWith(ext))
            if (!hasExt) continue
          }

          if (rule.pattern.test(lineText)) {
            findings.push({
              id: `${rule.id}-${filename}-${lineNumber}`,
              ruleId: rule.id,
              category: rule.category,
              severity: rule.severity,
              title: rule.title,
              description: rule.description,
              filename,
              line: lineNumber,
              codeSnippet: trimmed.slice(0, 140),
            })
          }
        }
      })
    }

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

  const auditContent = (content: string, filename = 'SKILL.md'): SkillAuditReport => {
    return auditFiles([{ path: filename, content }])
  }

  return {
    auditContent,
    auditFiles,
  }
}
