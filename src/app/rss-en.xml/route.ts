import { rssResponse } from '@/lib/rss'

// RSS feed of the English articles, same source and order as /rss.xml. Refreshed every 5 minutes.
export const revalidate = 300

export const GET = () => rssResponse('en')
