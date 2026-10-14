import { defineExamples } from '@/design/examples';
import { SectionHeading } from '@/units/section-heading';
import { CourseRow } from './index';
import spec from './spec';

export default defineExamples(spec, {
  states: {
    typical: () => (
      <CourseRow name="Electromagnetics" materials={7} sets={3} href="#" />
    ),
    singular: () => (
      <CourseRow name="Philosophy of mind" materials={1} sets={1} href="#" />
    ),
    empty: () => (
      <CourseRow name="Thermodynamics" materials={0} sets={0} href="#" />
    ),
    list: () => (
      <div>
        <SectionHeading count="3 courses">Courses</SectionHeading>
        <CourseRow name="Electromagnetics" materials={7} sets={3} href="#" />
        <CourseRow
          name="Signals and systems"
          materials={12}
          sets={8}
          href="#"
        />
        <CourseRow name="Philosophy of mind" materials={1} sets={1} href="#" />
      </div>
    ),
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <CourseRow
        name="Electromagnetics and the physics of electrical machines, second year, spring term"
        materials={12}
        sets={8}
        href="#"
      />
    </div>
  ),
});
