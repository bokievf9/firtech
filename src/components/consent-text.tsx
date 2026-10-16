import Link from 'next/link'

// Consent line under the contact form: the words in [brackets] link to the privacy policy.
export function ConsentText({ text, href }: { text: string; href: string }) {
  const [before, link, after] = text.split(/\[(.+?)\]/)
  if (link === undefined) return text
  return (
    <>
      {before}
      <Link
        href={href}
        className="underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg"
      >
        {link}
      </Link>
      {after}
    </>
  )
}
