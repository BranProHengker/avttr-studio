import { defineEventHandler, readBody, createError } from 'h3'

interface FetchRequest {
  input: string
  selectedSkill?: string
}

interface SkillFileInfo {
  name: string
  path: string
  content: string
}

interface FetchResponse {
  success: boolean
  owner: string
  repo: string
  branch: string
  selectedSkill: string
  availableSkills: string[]
  files: SkillFileInfo[]
  primaryContent: string
  installCommand: string
  error?: string
}

// In-memory cache for GitHub API requests (10 min TTL)
const cache = new Map<string, { data: FetchResponse; expires: number }>()

function parseInput(input: string): { owner: string; repo: string; branch: string; skillName?: string } {
  let cleaned = input.trim()

  // 1. Detect CLI command: npx skills add https://github.com/owner/repo --skill name
  const cliMatch = cleaned.match(/npx\s+skills\s+add\s+([^\s]+)(?:\s+--skill\s+([^\s]+))?/i)
  if (cliMatch) {
    cleaned = cliMatch[1]
    const explicitSkill = cliMatch[2]
    const parsed = parseInput(cleaned)
    if (explicitSkill) parsed.skillName = explicitSkill
    return parsed
  }

  // 2. Detect tree URL: https://github.com/owner/repo/tree/branch/skills/name
  const treeMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(?:skills|plugins)\/([^/]+))?/i)
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2].replace(/\.git$/, ''),
      branch: treeMatch[3] || 'main',
      skillName: treeMatch[4],
    }
  }

  // 3. Detect standard repo URL: https://github.com/owner/repo
  const repoMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/i)
  if (repoMatch) {
    return {
      owner: repoMatch[1],
      repo: repoMatch[2].replace(/\.git$/, ''),
      branch: 'main',
    }
  }

  // 4. Fallback: owner/repo string
  const slugMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (slugMatch) {
    return {
      owner: slugMatch[1],
      repo: slugMatch[2].replace(/\.git$/, ''),
      branch: 'main',
    }
  }

  throw new Error('Format link atau command tidak valid. Gunakan URL GitHub atau npx skills add ...')
}

export default defineEventHandler(async (event): Promise<FetchResponse> => {
  const body = await readBody<FetchRequest>(event)
  if (!body || !body.input) {
    throw createError({ statusCode: 400, message: 'Input URL atau command wajib diisi.' })
  }

  const { owner, repo, branch: parsedBranch, skillName: parsedSkill } = parseInput(body.input)
  const targetSkill = body.selectedSkill || parsedSkill || ''
  const cacheKey = `${owner}/${repo}:${targetSkill}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  let branch = parsedBranch || 'main'
  const headers = {
    'User-Agent': 'Avttr-Studio-SkillSpector/1.0',
    'Accept': 'application/vnd.github.v3+json',
  }

  // Discover available skills in repo
  let availableSkills: string[] = []
  try {
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/skills?ref=${branch}`
    const res = await $fetch<Array<{ name: string; type: string }>>(contentsUrl, {
      headers,
      timeout: 8000,
    }).catch(() => null)

    if (Array.isArray(res)) {
      availableSkills = res.filter(item => item.type === 'dir').map(item => item.name)
    }
  } catch {
    // Silently continue if API rate limited or /skills does not exist
  }

  // Determine active skill to inspect
  const activeSkill = targetSkill || (availableSkills.length > 0 ? availableSkills[0] : '')

  // Candidate paths for skill instructions
  const candidateUrls: string[] = []
  if (activeSkill) {
    candidateUrls.push(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${activeSkill}/SKILL.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${activeSkill}/SKILL.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${activeSkill}/README.md`,
    )
  }
  // Root fallbacks
  candidateUrls.push(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
  )

  let primaryContent = ''
  let fetchedPath = ''

  for (const url of candidateUrls) {
    try {
      const text = await $fetch<string>(url, { responseType: 'text', timeout: 7000 })
      if (text && typeof text === 'string' && text.trim().length > 0) {
        primaryContent = text
        fetchedPath = url
        break
      }
    } catch {
      // Try next candidate
    }
  }

  // If primary branch failed, try 'master' branch fallback
  if (!primaryContent && branch === 'main') {
    for (const url of candidateUrls) {
      try {
        const masterUrl = url.replace(`/${branch}/`, '/master/')
        const text = await $fetch<string>(masterUrl, { responseType: 'text', timeout: 7000 })
        if (text && typeof text === 'string' && text.trim().length > 0) {
          primaryContent = text
          fetchedPath = masterUrl
          branch = 'master'
          break
        }
      } catch {
        // Continue
      }
    }
  }

  if (!primaryContent) {
    throw createError({
      statusCode: 404,
      message: `Tidak dapat menemukan file SKILL.md di repositori ${owner}/${repo}. Pastikan repo publik dan folder skill benar.`,
    })
  }

  const files: SkillFileInfo[] = [
    {
      name: 'SKILL.md',
      path: activeSkill ? `skills/${activeSkill}/SKILL.md` : 'SKILL.md',
      content: primaryContent,
    },
  ]

  const installCommand = activeSkill
    ? `npx skills add https://github.com/${owner}/${repo} --skill ${activeSkill}`
    : `npx skills add https://github.com/${owner}/${repo}`

  const responseData: FetchResponse = {
    success: true,
    owner,
    repo,
    branch,
    selectedSkill: activeSkill,
    availableSkills,
    files,
    primaryContent,
    installCommand,
  }

  // Cache response for 10 minutes
  cache.set(cacheKey, { data: responseData, expires: Date.now() + 10 * 60 * 1000 })

  return responseData
})
