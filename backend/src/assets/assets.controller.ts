import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto, AllocateAssetDto, ReturnAssetDto } from './dto/assets.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Roles(SystemRole.HR_ADMIN)
  @Post('assets')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAssetDto) {
    return this.assets.createAsset(user.tenantId!, dto);
  }

  @Get('assets')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.assets.listAssets(user.tenantId!, status);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('assets/:id/allocate')
  allocate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AllocateAssetDto) {
    return this.assets.allocate(user.tenantId!, id, dto);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('assets/:id/return')
  returnAsset(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReturnAssetDto) {
    return this.assets.returnAsset(user.tenantId!, id, dto);
  }

  @Get('employees/:id/assets')
  employeeAssets(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.assets.getEmployeeAssets(user.tenantId!, id);
  }

  @Get('it-access-requests')
  listItAccessRequests(@CurrentUser() user: RequestUser, @Query('employeeId') employeeId?: string) {
    return this.assets.listItAccessRequests(user.tenantId!, employeeId);
  }

  @Patch('it-access-requests/:id/items/:itemIndex')
  completeItem(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('itemIndex', ParseIntPipe) itemIndex: number,
  ) {
    return this.assets.completeAccessItem(user.tenantId!, id, itemIndex);
  }
}
