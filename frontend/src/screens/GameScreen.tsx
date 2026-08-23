import { Seat } from '../components/Seat'
import { SplitLayout } from '../components/SplitLayout'
import { TableMenu } from '../components/TableMenu'
import { layoutById } from '../game/layout'
import { useStore } from '../state/store'

export function GameScreen() {
  const { config, seats, goto } = useStore()
  const preset = layoutById(config.layoutId)

  // Defensive: a persisted game whose layout id no longer exists.
  if (!preset || seats.length === 0) {
    return (
      <div className="step">
        <div className="step-inner">
          <h1 className="step-title">That game can’t be restored.</h1>
          <button className="btn primary" onClick={() => goto('players')}>
            Set up a new one
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <SplitLayout
        root={preset.root}
        renderSeat={(index) => {
          const seat = seats[index]
          return seat ? <Seat seat={seat} /> : null
        }}
      />
      <TableMenu />
    </>
  )
}
