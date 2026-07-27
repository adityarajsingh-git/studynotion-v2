import { Link } from "react-router-dom";
import { ApiCourse } from "../lib/api";
import { formatDuration, totalMinutes } from "../lib/format";

export default function CourseCard({ course }: { course: ApiCourse }) {
  const mins = totalMinutes(course.lessons);
  return (
    <Link
      to={`/courses/${course._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-edge bg-panel transition hover:-translate-y-1 hover:border-amber"
    >
      <div className="flex h-32 items-end p-4" style={{ background: `linear-gradient(135deg, ${course.thumbnailColor}33, ${course.thumbnailColor}0d)` }}>
        <span className="rounded-md px-2 py-1 text-xs font-semibold text-ink" style={{ background: course.thumbnailColor }}>
          {course.category?.name ?? "Course"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-semibold text-cream group-hover:text-amber">{course.title}</h3>
        <p className="line-clamp-2 flex-1 text-sm">{course.description}</p>
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-muted">{course.lessons.length} lessons · {formatDuration(mins)}</span>
          <span className="font-bold text-cream">₹{course.price}</span>
        </div>
      </div>
    </Link>
  );
}
