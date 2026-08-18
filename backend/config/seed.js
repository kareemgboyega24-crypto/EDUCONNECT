require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDb, User, Course, Enrollment, TimetableEntry, Assessment, Comment } = require('../models');

// Note: run with `npm run seed` from the backend/ folder.
// Creates one teacher, two students, one course, a timetable slot,
// one assessment submission, and a sample feedback comment thread.

async function seed() {
  await initDb();

  const passwordHash = await bcrypt.hash('password123', 10);

  const [admin] = await User.findOrCreate({
    where: { email: 'admin@educonnect.dev' },
    defaults: { fullName: 'Admin', passwordHash, role: 'admin', avatarColor: '#161A2B', emailVerified: true, active: true }
  });
  if (!admin.emailVerified) { admin.emailVerified = true; await admin.save(); }

  const [teacher] = await User.findOrCreate({
    where: { email: 'teacher@educonnect.dev' },
    defaults: { fullName: 'Dr. Amara Osei', passwordHash, role: 'lecturer', avatarColor: '#5B6CFF', emailVerified: true }
  });
  if (!teacher.emailVerified) { teacher.emailVerified = true; await teacher.save(); }
  if (teacher.role !== 'lecturer') { teacher.role = 'lecturer'; await teacher.save(); }

  const [student1] = await User.findOrCreate({
    where: { email: 'student1@educonnect.dev' },
    defaults: { fullName: 'Jordan Reyes', passwordHash, role: 'student', avatarColor: '#FF7A59', emailVerified: true }
  });
  if (!student1.emailVerified) { student1.emailVerified = true; await student1.save(); }

  const [student2] = await User.findOrCreate({
    where: { email: 'student2@educonnect.dev' },
    defaults: { fullName: 'Priya Nair', passwordHash, role: 'student', avatarColor: '#2FB88A', emailVerified: true }
  });
  if (!student2.emailVerified) { student2.emailVerified = true; await student2.save(); }

  const [course] = await Course.findOrCreate({
    where: { code: 'CS-204', teacherId: teacher.id },
    defaults: { name: 'Algorithms II', description: 'Graph algorithms, dynamic programming, and complexity.', teacherId: teacher.id }
  });

  await Enrollment.findOrCreate({ where: { courseId: course.id, studentId: student1.id } });
  await Enrollment.findOrCreate({ where: { courseId: course.id, studentId: student2.id } });

  await TimetableEntry.findOrCreate({
    where: { courseId: course.id, dayOfWeek: 1, startTime: '10:00' },
    defaults: { courseId: course.id, dayOfWeek: 1, endTime: '11:30', location: 'Room 204' }
  });
  await TimetableEntry.findOrCreate({
    where: { courseId: course.id, dayOfWeek: 3, startTime: '14:00' },
    defaults: { courseId: course.id, dayOfWeek: 3, endTime: '15:30', location: 'Room 204' }
  });

  const [assessment] = await Assessment.findOrCreate({
    where: { courseId: course.id, studentId: student1.id, title: 'Lab Report 3: Shortest Paths' },
    defaults: { courseId: course.id, studentId: student1.id, title: 'Lab Report 3: Shortest Paths', status: 'submitted' }
  });

  await Comment.findOrCreate({
    where: { assessmentId: assessment.id, authorId: teacher.id },
    defaults: { assessmentId: assessment.id, authorId: teacher.id, body: 'Thanks for submitting — I\'ll review this by Thursday. Can you clarify your choice of Dijkstra over Bellman-Ford in section 2?' }
  });

  console.log('\nSeed complete. Test accounts (all use password: password123):\n');
  console.log('  Admin   : admin@educonnect.dev');
  console.log('  Lecturer : teacher@educonnect.dev');
  console.log('  Student : student1@educonnect.dev  (has a submitted assessment)');
  console.log('  Student : student2@educonnect.dev\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
