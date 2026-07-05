import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { CreateReviewCycleDto, UpdateCycleStatusDto } from './dto/review-cycle.dto';
import { CreateGoalDto, UpdateGoalProgressDto } from './dto/goal.dto';
import { CalibrateReviewDto, SubmitManagerReviewDto, SubmitSelfReviewDto } from './dto/performance-review.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Roles(SystemRole.HR_ADMIN)
  @Post('review-cycles')
  createCycle(@CurrentUser() user: RequestUser, @Body() dto: CreateReviewCycleDto) {
    return this.performance.createCycle(user.tenantId!, dto);
  }

  @Get('review-cycles')
  listCycles(@CurrentUser() user: RequestUser) {
    return this.performance.listCycles(user.tenantId!);
  }

  @Get('review-cycles/:id')
  getCycle(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.performance.getCycle(user.tenantId!, id);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Patch('review-cycles/:id/status')
  updateCycleStatus(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateCycleStatusDto) {
    return this.performance.updateCycleStatus(user.tenantId!, id, dto.status);
  }

  @Post('goals')
  createGoal(@CurrentUser() user: RequestUser, @Body() dto: CreateGoalDto) {
    return this.performance.createGoal(user.tenantId!, dto);
  }

  @Get('goals')
  listGoals(
    @CurrentUser() user: RequestUser,
    @Query('employeeId') employeeId: string | undefined,
    @Query('cycleId') cycleId: string | undefined,
  ) {
    return this.performance.listGoals(user.tenantId!, { employeeId, cycleId });
  }

  @Patch('goals/:id/progress')
  updateGoalProgress(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateGoalProgressDto) {
    return this.performance.updateGoalProgress(user.tenantId!, id, dto);
  }

  @Get('review-cycles/:id/reviews')
  listReviews(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.performance.listReviews(user.tenantId!, id);
  }

  @Post('review-cycles/:id/reviews/:employeeId/self')
  submitSelfReview(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: SubmitSelfReviewDto,
  ) {
    return this.performance.submitSelfReview(user.tenantId!, id, employeeId, dto);
  }

  @Post('review-cycles/:id/reviews/:employeeId/manager')
  submitManagerReview(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: SubmitManagerReviewDto,
  ) {
    return this.performance.submitManagerReview(user.tenantId!, id, employeeId, dto);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Patch('review-cycles/:id/reviews/:employeeId/calibrate')
  calibrateReview(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: CalibrateReviewDto,
  ) {
    return this.performance.calibrateReview(user.tenantId!, id, employeeId, dto);
  }

  @Get('review-cycles/:id/rating-distribution')
  ratingDistribution(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('departmentId') departmentId: string | undefined,
  ) {
    return this.performance.ratingDistribution(user.tenantId!, id, departmentId);
  }
}
