'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { AchievementToasts, useAchievementNotifications } from '@/modules/achievements/ui'
import { useQuestNotifications } from '@/modules/quests/ui'
import { useTavernNotifications } from '@/modules/tavern/ui'
import { authClient } from '@/platform/auth/client'
import { readNumber, removeAll, SEEN_PREFIX, writeNumber } from './device-store'
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
const COLLAPSED_KEY = 'menu-replie'

/** Pastille d'un lien du menu : le nombre est plafonné à 9+ ; il est aussi lu, par sr-only. */
function NavBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <>
      <span key={count} className="nav-badge" aria-hidden="true">
        {count > 9 ? '9+' : count}
      </span>
      <span className="sr-only">
        , {count} nouveauté{count > 1 ? 's' : ''}
      </span>
    </>
  )
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
 * pastilles des nouveautés de chaque rubrique, et notifications des hauts faits débloqués.
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
  useEffect(() => setCollapsed(readNumber(COLLAPSED_KEY) === 1), [])

  // PASTILLES : chaque module fournit, par son entrée publique ui.tsx, le nombre de nouveautés
  // de sa rubrique (ADR 14). Le cadre ne fait que les afficher.
  const achievements = useAchievementNotifications(userId, pathname.startsWith('/achievements'))
  const quests = useQuestNotifications(pathname)
  const tavern = useTavernNotifications(userId, pathname.startsWith('/tavern'))
  const badges: Record<string, number> = {
    '/quests': quests,
    '/achievements': achievements.count,
    '/tavern': tavern,
  }
  const total = Object.values(badges).reduce((sum, n) => sum + n, 0)

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
      writeNumber(COLLAPSED_KEY, current ? 0 : 1)
      return !current
    })
  }

  async function signOut() {
    // La session est supprimée côté serveur, puis la page est entièrement rechargée,
    // afin qu'aucun état de la session précédente ne subsiste dans le navigateur.
    await authClient.signOut()
    // Les marqueurs « déjà vu » des pastilles ne survivent pas à la session (ADR 14).
    removeAll(SEEN_PREFIX)
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
          aria-label={
            open
              ? 'Fermer le menu'
              : `Ouvrir le menu${total > 0 ? `, ${total} nouveauté${total > 1 ? 's' : ''}` : ''}`
          }
          onClick={() => setOpen((value) => !value)}
        >
          <BurgerIcon />
          {/* Menu fermé : un point signale qu'une rubrique a des nouveautés. */}
          {total > 0 && !open && <span className="burger-dot" aria-hidden="true" />}
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
              <span className="nav-icon">
                <GameIcon kind={item.kind} size={22} decorative />
              </span>
              <span className="sidebar-text">{item.label}</span>
              <NavBadge count={badges[item.href] ?? 0} />
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
      <AchievementToasts toasts={achievements.toasts} />
    </div>
  )
}
