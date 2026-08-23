import { useEffect } from 'react'

import { AccountMenu } from './components/AccountMenu'
import { GameScreen } from './screens/GameScreen'
import { LayoutScreen, LifeScreen, PlayersScreen } from './screens/SetupScreens'
import { useStore } from './state/store'

export default function App() {
  const phase = useStore((s) => s.phase)
  const hydrate = useStore((s) => s.hydrate)

  // One bootstrap call on load. A 401 is the normal anonymous path: the tracker
  // works fully without an account, it just has no saved players to offer.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className={`app phase-${phase}`}>
      {phase === 'players' && <PlayersScreen />}
      {phase === 'life' && <LifeScreen />}
      {phase === 'layout' && <LayoutScreen />}
      {phase === 'game' && <GameScreen />}
      <AccountMenu />
    </div>
  )
}
