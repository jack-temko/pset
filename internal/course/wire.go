package course

// Course is a course the student is taking: Home lists them, and the course
// screen shows its work and materials.
type Course struct {
	// ID is the course's id.
	ID string `json:"id"`
	// Seq is the change-log sequence of its last change.
	Seq int64 `json:"seq"`
	// Name is what the student calls it ("ECE 210").
	Name string `json:"name"`
	// CreatedAt is when it was added (RFC 3339).
	CreatedAt string `json:"createdAt"`
	// RemovedAt is when the student removed it (RFC 3339): hidden, and back
	// with Undo for a week. Absent while it is there.
	RemovedAt string `json:"removedAt,omitempty"`
}

// Courses is the student's courses, in the order they were added. Never
// null.
type Courses struct {
	// Courses is every course not removed.
	Courses []Course `json:"courses"`
}

// The course actions' inputs (internal/action): what the page sends to
// POST /api/actions/course.add and the rest.
type (
	// Add is a new course, by name.
	Add struct {
		Name string `json:"name"`
	}
	// Rename gives a course a new name.
	Rename struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	// Remove hides a course, with everything in it, for a week.
	Remove struct {
		ID string `json:"id"`
	}
)
