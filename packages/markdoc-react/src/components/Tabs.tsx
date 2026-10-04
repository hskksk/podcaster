import { Children, isValidElement, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'

export interface TabProps {
  label?: string
  children?: ReactNode
}

export function Tab({ children }: TabProps) {
  return <div className="markdoc-tab">{children}</div>
}

export function Tabs({ children }: { children?: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<TabProps>[]
  const [requested, setRequested] = useState(0)
  const baseId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  if (items.length === 0) return null

  const active = Math.min(requested, items.length - 1)

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next == null) return
    event.preventDefault()
    setRequested(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="markdoc-tabs">
      <div className="markdoc-tabs__list" role="tablist" aria-orientation="horizontal">
        {items.map((item, index) => (
          <button
            key={index}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            id={`${baseId}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={index === active ? 0 : -1}
            className={`markdoc-tabs__tab${index === active ? ' markdoc-tabs__tab--active' : ''}`}
            onClick={() => setRequested(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.props.label ?? `Tab ${index + 1}`}
          </button>
        ))}
      </div>
      <div
        id={`${baseId}-panel`}
        className="markdoc-tabs__panel"
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
      >
        {items[active]}
      </div>
    </div>
  )
}
