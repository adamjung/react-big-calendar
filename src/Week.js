import PropTypes from 'prop-types'
import React from 'react'
import dates from './utils/dates'
import localizer from './localizer'
import { navigate } from './utils/constants'
import TimeGrid from './TimeGrid'

class Week extends React.Component {
  static propTypes = {
    date: PropTypes.object.isRequired,
  }

  static defaultProps = TimeGrid.defaultProps

  render() {
    const { date, ...props } = this.props
    const range = Week.range(date, this.props)
    const events = this.props.events

    const start = range[0]
    const end = range[range.length - 1]
    return (
      <TimeGrid
        {...props}
        min={start}
        max={end}
        range={range}
        eventOffset={15}
      />
    )
  }
}

Week.navigate = (date, action) => {
  switch (action) {
    case navigate.PREVIOUS:
      return dates.add(date, -1, 'week')

    case navigate.NEXT:
      return dates.add(date, 1, 'week')

    default:
      return date
  }
}

Week.range = (date, { culture }) => {
  let firstOfWeek = localizer.startOfWeek(culture)
  let start = dates.startOf(date, 'week', firstOfWeek)
  let end = dates.endOf(date, 'week', firstOfWeek)

  return dates.range(start, end)
}

Week.title = (date, { formats, culture }) => {
  let [start, ...rest] = Week.range(date, { culture })
  return localizer.format(
    { start, end: rest.pop() },
    formats.dayRangeHeaderFormat,
    culture
  )
}

export default Week
