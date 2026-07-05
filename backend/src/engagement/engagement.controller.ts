import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { CreateAnnouncementDto, CreateRecognitionDto, CreateSurveyDto, SubmitSurveyResponseDto } from './dto/engagement.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Roles(SystemRole.HR_ADMIN)
  @Post('announcements')
  createAnnouncement(@CurrentUser() user: RequestUser, @Body() dto: CreateAnnouncementDto) {
    return this.engagement.createAnnouncement(user.tenantId!, user, dto);
  }

  @Get('announcements')
  listAnnouncements(@CurrentUser() user: RequestUser) {
    return this.engagement.listAnnouncements(user.tenantId!);
  }

  @Post('recognitions')
  createRecognition(@CurrentUser() user: RequestUser, @Body() dto: CreateRecognitionDto) {
    return this.engagement.createRecognition(user.tenantId!, user, dto);
  }

  @Get('recognitions')
  listRecognitions(@CurrentUser() user: RequestUser) {
    return this.engagement.listRecognitions(user.tenantId!, user);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('surveys')
  createSurvey(@CurrentUser() user: RequestUser, @Body() dto: CreateSurveyDto) {
    return this.engagement.createSurvey(user.tenantId!, dto);
  }

  @Get('surveys')
  listSurveys(@CurrentUser() user: RequestUser) {
    return this.engagement.listSurveys(user.tenantId!);
  }

  @Post('surveys/:id/responses')
  submitResponse(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SubmitSurveyResponseDto) {
    return this.engagement.submitResponse(user.tenantId!, id, user, dto);
  }

  @Get('surveys/:id/results')
  getResults(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.engagement.getResults(user.tenantId!, id);
  }
}
