import { ICON_PATHS } from './icon-paths'
import { look } from './theme'

/**
 * Icône dessinée d'une entité du jeu (ressource...), à partir de game-icons.net.
 * Une entité sans icône dessinée est présentée par son symbole, comme le fait Entity.
 * Le libellé est lu par les lecteurs d'écran et affiché au survol.
 */
export function GameIcon({ kind, size = 24 }: { kind: string; size?: number }) {
  const { glyph, label } = look(kind)
  const path = ICON_PATHS[kind]
  if (!path) {
    return (
      <span className="entity" title={label}>
        <span aria-hidden="true">{glyph}</span>
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return (
    <svg
      className={`game-icon game-icon-${kind}`}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path fill="currentColor" d={path} />
    </svg>
  )
}
