import {
  ZonedDateTime,
  Instant,
  LocalTime,
  LocalDate,
  LocalDateTime,
  ZoneId,
} from 'js-joda'
import { accessor as get } from '../accessors'
import dates from '../dates'

export function startsBefore(date, min) {
  return dates.lt(dates.merge(min, date), min, 'minutes')
}

export function positionFromDate(date, min) {
  if (startsBefore(date, min)) {
    return 0
  }

  const diff = dates.diff(min, dates.merge(min, date), 'minutes')
  return diff
}

export class Event {
  constructor(data, props) {
    const {
      startAccessor,
      endAccessor,
      min,
      totalMin,
      timezone,
      getNow,
    } = props
    const [startDate, endDate] = normalizeDates(
      get(data, startAccessor),
      get(data, endAccessor),
      props
    )

    this.startSlot = positionFromDate(startDate, min)
    this.endSlot = positionFromDate(endDate, min)

    this.start = dates.nativeTime(startDate)
    this.end = dates.nativeTime(endDate)
    this.top = this.startSlot / totalMin * 100
    this.height = this.endSlot / totalMin * 100 - this.top
    this.data = data
  }

  /**
   * The event's width without any overlap.
   */
  get _width() {
    // The container event's width is determined by the maximum number of
    // events in any of its rows.
    if (this.rows) {
      const columns =
        this.rows.reduce((max, row) => {
          return Math.max(max, row.leaves.length + 1) // add itself
        }, 0) + 1 // add the container

      return 100 / columns
    }

    const availableWidth = 100 - this.container._width

    // The row event's width is the space left by the container, divided
    // among itself and its leaves.
    if (this.leaves) {
      return availableWidth / (this.leaves.length + 1)
    }

    // The leaf event's width is determined by its row's width
    return this.row._width
  }

  /**
   * The event's calculated width, possibly with extra width added for
   * overlapping effect.
   */
  get width() {
    const noOverlap = this._width
    const overlap = Math.min(100, this._width * 1.7)

    // Containers can always grow.
    if (this.rows) {
      return overlap
    }

    // Rows can grow if they have leaves.
    if (this.leaves) {
      return this.leaves.length > 0 ? overlap : noOverlap
    }

    // Leaves can grow unless they're the last item in a row.
    const { leaves } = this.row
    const index = leaves.indexOf(this)
    return index === leaves.length - 1 ? noOverlap : overlap
  }

  get xOffset() {
    // Containers have no offset.
    if (this.rows) {
      return 0
    }

    // Rows always start where their container ends.
    if (this.leaves) {
      return this.container._width
    }

    // Leaves are spread out evenly on the space left by its row.
    const { leaves, xOffset, _width } = this.row
    const index = leaves.indexOf(this) + 1
    return xOffset + index * _width
  }
}

export function convertToTimezone(date, tzString) {
  const zoneId = ZoneId.of(tzString)

  if (date.constructor.name === 'LocalDate') {
    return ZonedDateTime.of(date, LocalTime.MIDNIGHT, zoneId)
  } else if (date.constructor.name === 'LocalDateTime') {
    return ZonedDateTime.of(date, zoneId)
  } else if (date.constructor.name === 'ZonedDateTime') {
    if (date.zone().id === zoneId.id()) {
      return date
    }

    try {
      return date.withZoneSameInstant(zoneId)
    } catch (e) {
      return ZonedDateTime.ofInstant(
        Instant.ofEpochMilli(dates.nativeTime(date)),
        zoneId
      )
    }
  }

  // shouldn't end up here
  return ZonedDateTime.now(zoneId)
}

/**
 * Return start and end dates with respect to timeslot positions.
 */
function normalizeDates(
  startDate,
  endDate,
  { showMultiDayTimes, timezone, getNow }
) {
  const zonedStartDate = convertToTimezone(startDate, timezone)
  const zonedEndDate = convertToTimezone(endDate, timezone)

  if (!showMultiDayTimes) {
    return [zonedStartDate, zonedEndDate]
  }

  let current = getNow()

  // Use noon to compare dates to avoid DST issues.
  let s = dates.hours(zonedStartDate, 12)
  let e = dates.hours(zonedEndDate, 12)
  let c = dates.hours(current, 12)

  // Current day is at the start, but it spans multiple days,
  // so we correct the end.
  if (dates.eq(c, s) && dates.lt(c, e)) {
    return [zonedStartDate, dates.endOf(zonedStartDate, 'day')]
  }

  // Current day is in between start and end dates,
  // so we make it span all day.
  if (dates.gt(c, s) && dates.lt(c, e)) {
    return [current, dates.endOf(current, 'day')]
  }

  // Current day is at the end of a multi day event,
  // so we make it start at midnight, and end normally.
  if (dates.gt(c, s) && dates.eq(c, e)) {
    return [current, zonedEndDate]
  }

  return [zonedStartDate, zonedEndDate]
}
