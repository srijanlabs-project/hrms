import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TrainingStatus } from '@prisma/client';
import { LearningService } from './learning.service';
import { CreateCourseDto } from './dto/course.dto';
import { CompleteTrainingDto, CreateTrainingAssignmentDto } from './dto/training-assignment.dto';
import { CreateCertificationDto } from './dto/certification.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Roles(SystemRole.HR_ADMIN)
  @Post('courses')
  createCourse(@CurrentUser() user: RequestUser, @Body() dto: CreateCourseDto) {
    return this.learning.createCourse(user.tenantId!, dto);
  }

  @Get('courses')
  listCourses(@CurrentUser() user: RequestUser) {
    return this.learning.listCourses(user.tenantId!);
  }

  @Roles(SystemRole.HR_ADMIN, SystemRole.MANAGER)
  @Post('training-assignments')
  createAssignments(@CurrentUser() user: RequestUser, @Body() dto: CreateTrainingAssignmentDto) {
    return this.learning.createAssignments(user.tenantId!, user.userId, dto);
  }

  @Get('training-assignments')
  listAssignments(
    @CurrentUser() user: RequestUser,
    @Query('employeeId') employeeId: string | undefined,
    @Query('courseId') courseId: string | undefined,
    @Query('status') status: TrainingStatus | undefined,
  ) {
    return this.learning.listAssignments(user.tenantId!, { employeeId, courseId, status });
  }

  @Post('training-assignments/:id/start')
  startAssignment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.learning.startAssignment(user.tenantId!, id);
  }

  @Patch('training-assignments/:id/complete')
  completeAssignment(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CompleteTrainingDto) {
    return this.learning.completeAssignment(user.tenantId!, id, dto);
  }

  @Post('certifications')
  createCertification(@CurrentUser() user: RequestUser, @Body() dto: CreateCertificationDto) {
    return this.learning.createCertification(user.tenantId!, dto);
  }

  @Get('certifications/expiring')
  listExpiring(@CurrentUser() user: RequestUser, @Query('withinDays') withinDays: string | undefined) {
    return this.learning.listExpiring(user.tenantId!, withinDays ? Number(withinDays) : undefined);
  }
}
