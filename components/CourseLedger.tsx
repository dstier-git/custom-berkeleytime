import type { Course } from '@/lib/types'
import CourseCard from './CourseCard'

interface CourseLedgerProps {
  courses: Course[]
  tab: 'list' | 'trash'
  trashCourse: (course: Course) => void
  restoreCourse: (course: Course) => void
}

export default function CourseLedger({ courses, tab, trashCourse, restoreCourse }: CourseLedgerProps) {
  if (courses.length === 0) {
    return (
      <div className="empty">
        <p>{tab === 'trash' ? 'Nothing in the trash.' : 'No courses match these filters.'}</p>
        <p style={{ fontSize: 13 }}>
          {tab === 'trash'
            ? 'Dismissed courses land here and can be restored.'
            : 'Try widening the Seats or Prereqs filters.'}
        </p>
      </div>
    )
  }

  return (
    <div className="ledger">
      {courses.map(c => (
        <CourseCard
          key={c.code}
          course={c}
          tab={tab}
          onAction={tab === 'trash' ? restoreCourse : trashCourse}
        />
      ))}
    </div>
  )
}
