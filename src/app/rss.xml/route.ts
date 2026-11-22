import { rssResponse } from '@/lib/rss'

// RSS feed of the Russian articles (bundled and from HQ), newest first. Refreshed every 5 minutes.
// The English feed is /rss-en.xml.
export const revalidate = 300

export const GET = () => rssResponse('ru')
