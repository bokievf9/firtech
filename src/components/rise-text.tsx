'use client'

import { motion } from 'motion/react'
import { Fragment } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { TitleReveal } from './motion/title-reveal'

type Tag = 'h1' | 'h2' | 'h3' | 'p'

// Section headline that rises in word by word from behind a mask as it scrolls into view.
// The words stay real text, so search engines and screen readers read the plain sentence.
export function RiseText({
  as: Tag = 'h2',
  text,
  className,
  delay = 0,
}: {
  as?: Tag
  text: string
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  const words = text.split(' ')

  // A page's h1 uses the title reveal (T-A, plain CSS, paints without JavaScript); section titles keep the masked rise.
  if (Tag === 'h1') return <TitleReveal as="h1" className={className}>{text}</TitleReveal>

  return (
    <Tag className={className}>
      <motion.span
        className="block"
        initial={reduce ? false : 'hidden'}
        whileInView="show"
        viewport={{ once: true, amount: 0.6 }}
        variants={{ show: { transition: { staggerChildren: 0.055, delayChildren: delay } } }}
      >
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top">
              <motion.span
                className="inline-block"
                variants={{
                  hidden: { y: '110%', rotate: 4 },
                  show: {
                    y: '0%',
                    rotate: 0,
                    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                {word}
              </motion.span>
            </span>
            {/* The space lives outside the clipped box, or the browser would collapse it. */}
            {i < words.length - 1 && ' '}
          </Fragment>
        ))}
      </motion.span>
    </Tag>
  )
}
