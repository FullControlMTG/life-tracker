import { useEffect } from 'react'

import { AccountMenu } from './components/AccountMenu'
import { GameScreen } from './screens/GameScreen'
import { LayoutScreen, LifeScreen, PlayersScreen } from './screens/SetupScreens'
import { fontStacks } from './game/display'
import { useStore } from './state/store'

export default function App() {
  const phase = useStore((s) => s.phase)
  const display = useStore((s) => s.display)
  const hydrate = useStore((s) => s.hydrate)

  // One bootstrap call on load. A 401 is the normal anonymous path: the tracker
  // works fully without an account, it just has no saved players to offer.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Display settings are pushed onto the root as custom properties, so the
  // whole stylesheet picks them up without any component knowing about them.
  const fonts = fontStacks(display.font)

  return (
    <div
      className={`app phase-${phase}`}
      data-tap-split={display.tapSplit}
      style={{
        ['--font' as string]: fonts.stack,
        ['--numerals' as string]: fonts.numerals,
        ['--font-scale' as string]: display.fontScale,
      }}
    >
      {phase === 'players' && <PlayersScreen />}
      {phase === 'life' && <LifeScreen />}
      {phase === 'layout' && <LayoutScreen />}
      {phase === 'game' && <GameScreen />}
      <AccountMenu />
    </div>
  )
}
