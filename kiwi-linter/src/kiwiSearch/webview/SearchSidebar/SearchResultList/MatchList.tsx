import { useHover } from 'react-use'
import type { DisplayResult } from '../../../types'
import { CodeBlock } from './CodeBlock'
import { useActiveItem } from './useListState'

import * as stylex from '@stylexjs/stylex'
import { memo } from 'react'

const styles = stylex.create({
  codeItem: {
    display: 'flex',
    paddingLeft: 46,
    paddingRight: 2,
    listStyle: 'none',
    ':hover': {
      background: 'var( --vscode-list-hoverBackground)',
    },
  },
  active: {
    background: 'var(--vscode-list-inactiveSelectionBackground)',
    ':focus': {
      color: 'var(--vscode-list-activeSelectionForeground)',
      background: 'var(--vscode-list-activeSelectionBackground)',
      outline:
        '1px solid var(--vscode-list-focusAndSelectionOutline, var(--vscode-contrastActiveBorder, var(--vscode-list-focusOutline)))',
      outlineOffset: -1,
    },
  },
})

function OneMatch({ langKey, match }: { langKey: string; match: DisplayResult }) {
  const [active, setActive] = useActiveItem(match)
  const styleProps = stylex.props(styles.codeItem, active && styles.active)
  const [hoverable] = useHover(hovered => {
    return (
      // biome-ignore lint/a11y/noNoninteractiveTabindex: need it for styling
      <li {...styleProps} onClick={setActive} tabIndex={0}>
        <CodeBlock match={match} />
      </li>
    )
  })
  return hoverable
  
}

interface CodeBlockListProps {
  langKey: string
  matches: DisplayResult[]
}
export const MatchList = memo(({ langKey, matches }: CodeBlockListProps) => {
  return (
    <>
      {matches?.map(match => {
        const { file, range } = match
        const { byteOffset } = range
        const key = file + byteOffset.start + byteOffset.end
        return <OneMatch key={key} langKey={langKey} match={match} />
      })}
    </>
  )
})
