import { ListApiRequestParams1 } from '@src/pages/organization/list/api';
import createApiHooks from 'create-api-hooks';
import { ListApiResponseData, request } from 'parsec-admin';

export interface AccountListItem {
  id: number; //用户ID
  username: string; //帐号
  role: string; //角色名称
  branchHospitalName: string; //院区名称(医院名称)
  title: string; //部门职务
  name: string; //帐号姓名
  phone: string; //联系电话
  status: boolean; //帐号状态 true 启用  false 禁用
  createdAt: string; //创建时间
  isHospitalDefaultAdmin: boolean; //是否医院默认管理员,如果为true,则不允许任何操作
}

export default {
  // 医院后台管理帐号分页列表
  getAccountList: createApiHooks(
    (
      params: ListApiRequestParams1 & {
        branchHospitalId?: number;
        name?: string;
        username?: string;
        startAt?: string;
        endAt?: string;
        status?: boolean;
      }
    ) =>
      request.get<ListApiResponseData<AccountListItem>>('/admin/account/list', {
        params
      })
  ),
  // 启用帐号(包含批量)
  accountStart: createApiHooks((
    params: { accountIds: number[] } //帐号ID
  ) => request.put('/admin/account/start', params)),
  // 禁用帐号(包含批量)
  accountStop: createApiHooks((
    params: { accountIds: number[] } //帐号ID
  ) => request.put('/admin/account/stop', params)),
  // 删除帐号(包含批量)
  accountDel: createApiHooks((
    params: { accountIds: number[] } //帐号ID
  ) => request.delete('/admin/account/del', { data: params })),
  // 重置密码
  accountResetPwd: createApiHooks((params: { id: number }) =>
    request.put('/admin/account/reset-pwd/' + params.id)
  ),
  // 添加/编辑帐号
  accountSave: createApiHooks(
    (params: {
      id: number; //帐号ID,编辑时必传,否则按添加处理
      username: string; //帐号登录名
      branchHospitalId: number; //院区ID
      officeId: number; //科室ID
      title: string; //部门职称
      name: string; //姓名
      phone: string; //联系电话
      isEnabled: true; //状态: true 启用  false 禁用
    }) => request.post('/admin/account/save', params)
  ),
  // 配置帐号角色
  accountRoleSetting: createApiHooks((
    params: { id: number; roles: number[] } //帐号ID //角色ID集合
  ) => request.post('/admin/account/role/setting', params))
};
