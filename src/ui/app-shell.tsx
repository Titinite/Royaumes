'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { AchievementToasts } from '@/modules/achievements/ui'
import { authClient } from '@/platform/auth/client'
import { GameIcon } from './game-icon'

/** Liens de navigation : chaque module ajouté au jeu y reçoit une entrée. */
export const NAV = [
  { href: '/village', kind: 'village', label: 'Village' },
  { href: '/dungeon', kind: 'dungeon', label: 'Donjon' },
  { href: '/ranking', kind: 'ranking', label: 'Classement' },
  { href: '/market', kind: 'market', label: 'Marché' },
  { href: '/tavern', kind: 'tavern', label: 'Taverne' },
  { href: '/quests', kind: 'quests', label: 'Quêtes' },
  { href: '/achievements', kind: 'achievements', label: 'Hauts faits' },
]

/** Grand écran : le menu y est toujours visible. Même seuil que dans globals.css. */
const WIDE_SCREEN = '(min-width: 1024px)'

/** Clé du stockage local qui retient le menu replié, sur grand écran. */
const COLLAPSED_KEY = 'royaumes.menu-replie'

/** Lecture et écriture du stockage local : il peut être indisponible (navigation privée). */
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}
function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // Le choix ne sera simplement pas retenu.
  }
}

/** Icône du bouton de menu : trois traits, qui se croisent lorsque le menu est ouvert. */
function BurgerIcon() {
  return (
    <span className="burger" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

/**
 * Cadre de l'espace de jeu : menu latéral, nom du joueur, accès à ses données, déconnexion,
 * et notifications des hauts faits débloqués, visibles sur chaque page.
 * Sur grand écran, le menu est toujours visible, et peut être replié en une colonne d'icônes.
 * Sur petit écran, il est masqué derrière le bouton de la barre du haut, et s'ouvre en tiroir.
 */
export function AppShell({
  userId,
  userName,
  children,
}: {
  userId: string
  userName: string
  children: ReactNode
}) {
  const pathname = usePathname()
  // Tiroir ouvert, sur petit écran ; menu replié, sur grand écran.
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const burger = useRef<HTMLButtonElement>(null)
  const firstLink = useRef<HTMLAnchorElement>(null)

  // Le choix du menu replié est relu après le premier rendu, identique sur le serveur.
  useEffect(() => setCollapsed(readCollapsed()), [])

  // Le tiroir se referme à chaque changement de page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: la page courante déclenche la fermeture.
  useEffect(() => setOpen(false), [pathname])

  // Passage sur grand écran, par exemple en tournant une tablette : le tiroir n'a plus lieu d'être.
  useEffect(() => {
    const wide = window.matchMedia(WIDE_SCREEN)
    const onChange = () => wide.matches && setOpen(false)
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [])

  // Tiroir ouvert : la page ne défile plus, Échap le referme, et le focus entre dans le menu.
  // À la fermeture, le focus revient au bouton qui l'a ouvert.
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    firstLink.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      burger.current?.focus()
    }
  }, [open])

  function toggleCollapsed() {
    setCollapsed((current) => {
      writeCollapsed(!current)
      return !current
    })
  }

  async function signOut() {
    // La session est supprimée côté serveur, puis la page est entièrement rechargée,
    // afin qu'aucun état de la session précédente ne subsiste dans le navigateur.
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="shell" data-collapsed={collapsed} data-open={open}>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      {/* Barre du haut, sur petit écran seulement : bouton du menu et nom du jeu. */}
      <header className="topbar">
        <button
          ref={burger}
          type="button"
          className="icon-button"
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <BurgerIcon />
        </button>
        <Link href="/village" className="brand topbar-brand">
          <GameIcon kind="village" size={22} decorative />
          Royaumes
        </Link>
      </header>

      <aside id="menu-principal" className="sidebar" aria-label="Menu principal">
        <div className="sidebar-head">
          <Link href="/village" className="brand">
            <GameIcon kind="village" size={26} decorative />
            <span className="sidebar-text">Royaumes</span>
          </Link>
          <button
            type="button"
            className="icon-button sidebar-collapse"
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            onClick={toggleCollapsed}
          >
            <BurgerIcon />
          </button>
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              ref={i === 0 ? firstLink : undefined}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              <GameIcon kind={item.kind} size={22} decorative />
              <span className="sidebar-text">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-user">
          <span className="player" title={userName}>
            <span className="avatar" aria-hidden="true">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="sidebar-text">{userName}</span>
          </span>
          <Link
            href="/account"
            title={collapsed ? 'Mes données' : undefined}
            aria-current={pathname === '/account' ? 'page' : undefined}
          >
            <GameIcon kind="account" size={20} decorative />
            <span className="sidebar-text">Mes données</span>
          </Link>
          <button
            type="button"
            className="sidebar-logout"
            title={collapsed ? 'Déconnexion' : undefined}
            onClick={signOut}
          >
            <GameIcon kind="logout" size={20} decorative />
            <span className="sidebar-text">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Voile du tiroir, sur petit écran : un clic en dehors du menu le referme. */}
      <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />

      {/* Tiroir ouvert : le contenu est inerte, le focus reste dans le menu. */}
      <main id="contenu" className="shell-content" inert={open}>
        {children}
      </main>
      <AchievementToasts userId={userId} />
    </div>
  )
}
