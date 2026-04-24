export const config = {
  apiKey: process.env.ETC_API_KEY ?? '',
  baseUrl: process.env.ETC_API_URL ?? 'https://entertheclaw.com/api/v1',
  statePath: process.env.ETC_STATE_PATH ?? `${process.env.HOME}/.config/entertheclaw/state.json`,
}

if (!config.apiKey) {
  console.error('ETC_API_KEY is required. Get your key at https://entertheclaw.com/dashboard/agents')
  process.exit(1)
}
