import { ICON_PATHS } from './icon-paths'
import { look } from './theme'

/**
 * Icône dessinée d'une entité du jeu (ressource...), à partir de game-icons.net.
 * Une entité sans icône dessinée est présentée par son symbole, comme le fait Entity.
 * Le libellé est lu par les lecteurs d'écran et affiché au survol, sauf pour une icône
 * décorative, placée à côté d'un texte qui dit déjà la même chose.
 */
export function GameIcon({
  kind,
  size = 24,
  decorative = false,
}: {
  kind: string
  size?: number
  decorative?: boolean
}) {
  const { glyph, label } = look(kind)
  const path = ICON_PATHS[kind]
  if (decorative) {
    return path ? (
      <svg
        className={`game-icon game-icon-${kind}`}
        width={size}
        height={size}
        viewBox="0 0 512 512"
        aria-hidden="true"
        focusable="false"
      >
        <path fill="currentColor" d={path} />
      </svg>
    ) : (
      <span aria-hidden="true">{glyph}</span>
    )
  }
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
