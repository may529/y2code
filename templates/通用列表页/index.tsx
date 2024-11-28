import React, { useEffect, useState } from 'react';
import {
  TableList,
  ActionsWrap,
  LinkButton,
  useTableRowSelect,
  DayRangePicker,
  actionConfirm,
  ArrSelect,
  useModal,
  handleSubmit
} from 'parsec-admin';
import apis from './api';
import apis1 from '../role/api';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Switch,
  Table
} from 'antd';
import styled from 'styled-components';
import { paginationSetUp } from '@src/pages/merchant/merchantList';
import storage from '@src/utils/storage';
import apiBranchHospitalList from '@src/pages/login/apis';
import apis2, { HospitalOfficeItem } from '@src/pages/hospital/department/api';

const { Password } = Input;

export default () => {
  const [form] = Form.useForm();

  const accountStatus = [
    {
      value: true,
      children: '启用'
    },
    {
      value: false,
      children: '禁用'
    }
  ];

  const [roleVisible, setRoleVisible] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number[]>();
  const [currentAccountId, setCurrentAccountId] = useState<number>();

  const [branchHospitalId, setBranchHospitalId] = useState<number>(); // 选择的院区id, 用来与科室联动
  const [officeList, setOfficeList] = useState<HospitalOfficeItem[]>();

  const switchModalVisible = useModal(
    ({ id }) => ({
      title: `${id ? '编辑' : '新增'}账号`,
      form: form,
      onSubmit: ({ ...values }: any) =>
        handleSubmit(() => {
          return apis.accountSave.request({ ...values });
        }),
      items: [
        {
          name: 'id',
          render: false
        },
        {
          label: '账号',
          name: 'username',
          render: <Input placeholder='请输入用户账号，仅限英文字符及数字' />,
          formItemProps: {
            rules: [
              {
                required: true,
                message: '账号是必填的'
              },
              () => ({
                validator(_rule, value) {
                  const regx3 = /^[a-zA-Z0-9]{1,}$/;
                  if (!value || regx3.test(value)) {
                    return Promise.resolve();
                  }
                  return Promise.reject('账号仅限英文字符及数字');
                }
              })
            ]
          }
        },
        {
          label: '密码',
          name: 'newPassword',
          hidden: !!id,
          formItemProps: {
            rules: [
              {
                required: !id,
                message: '密码是必填的'
              }
            ]
          },
          render: <Password placeholder='请输入密码' />
        },
        {
          label: '确认密码',
          name: 'rePassword',
          hidden: !!id,
          formItemProps: {
            dependencies: ['password'],
            rules: [
              {
                required: !id,
                message: '确认密码是必填的'
              },
              ({ getFieldValue }) => ({
                validator(rule, value1) {
                  if (!value1 || getFieldValue('newPassword') === value1) {
                    return Promise.resolve();
                  }
                  return Promise.reject('两次密码不一致');
                }
              })
            ]
          },
          render: <Password placeholder='请再次确认密码' />
        },
        {
          label: '所属院区',
          required: true,
          name: 'branchHospitalId',
          render: (
            <ArrSelect
              options={(branchHospitalList || []).map(x => {
                return {
                  value: x.id,
                  children: x.name
                };
              })}
              onChange={value => {
                setBranchHospitalId(value as number);
                form.resetFields(['officeId']);
              }}
            />
          )
        },
        {
          label: '所属科室',
          name: 'officeId',
          required: true,
          render: (
            <ArrSelect
              options={(officeList || []).map(x => {
                return {
                  value: x.id,
                  children: x.officeName
                };
              })}
            />
          )
        },
        {
          label: '部门职称',
          name: 'title',
          required: true
        },
        {
          label: '姓名',
          name: 'name',
          required: true
        },
        {
          label: '联系电话',
          name: 'phone',
          formItemProps: {
            rules: [
              { required: true, message: '请输入手机号码!' },
              () => ({
                validator(_rule, value1) {
                  return !value1 || /^1[3-9][0-9]{9}$/.test(value1)
                    ? Promise.resolve()
                    : Promise.reject(new Error('请输入正确的手机号!'));
                }
              })
            ]
          }
        },
        {
          label: '账号状态', //状态: true 启用  false 禁用
          name: 'isEnabled',
          required: true,
          render: (
            <Radio.Group>
              <Radio value={true}>开启</Radio>
              <Radio value={false}>关闭</Radio>
            </Radio.Group>
          )
        }
      ]
    }),
    [officeList]
  );

  const { rowSelection, paginationExtra } = useTableRowSelect([
    {
      actionText: '批量禁用',
      onClick: applyIds =>
        apis.accountStop.request({
          accountIds: applyIds
        })
    },
    {
      actionText: '批量启用',
      onClick: applyIds =>
        apis.accountStart.request({
          accountIds: applyIds
        })
    },
    {
      actionText: '批量删除',
      onClick: applyIds =>
        apis.accountDel.request({
          accountIds: applyIds
        }),
      danger: true
    }
  ]);

  // 获取所有的角色
  const {
    data: { list: roleList }
  } = apis1.getroleList({
    initValue: [],
    params: {
      page: 1,
      size: 1000,
      status: true
    }
  });

  // 获取院区列表
  const { data: branchHospitalList } = apiBranchHospitalList.branchHospitalList(
    {
      params: {
        hospitalId: Number(storage.get('userInfo')?.hospitalId || 0)
      },
      initValue: [],
      needInit: !!storage.get('userInfo')?.hospitalId
    }
  );

  // 获取科室
  useEffect(() => {
    if (branchHospitalId || branchHospitalId === 0) {
      apis2.getHospitalOfficeList
        .request({
          page: 1,
          size: 999,
          branchHospitalId: branchHospitalId
        })
        .then(response => {
          setOfficeList(response?.list || []);
        });
    } else {
      setOfficeList([]);
    }
  }, [branchHospitalId]);

  return (
    <>
      <TableList
        rowSelection={{
          ...rowSelection,
          getCheckboxProps: (record: any) => ({
            disabled: record.isHospitalDefaultAdmin // 医院默认管理员不允许操作
          })
        }}
        extra={paginationExtra}
        tableTitle={'账号列表'}
        showTool={false}
        showExpand={false}
        scroll={{ x: 1600 }}
        action={
          <Button
            type='primary'
            onClick={() => {
              switchModalVisible();
              setBranchHospitalId(undefined);
            }}>
            新增
          </Button>
        }
        columns={[
          {
            title: '账号',
            dataIndex: 'username',
            align: 'center',
            width: 150
          },
          {
            title: '帐号类型',
            dataIndex: 'accountType',
            align: 'center',
            width: 150
          },
          {
            title: '所属角色',
            dataIndex: 'role',
            align: 'center',
            width: 150,
            render: v =>
              v
                ? v.split(',').map((item, i) => {
                    return <div key={i}>{item}</div>;
                  })
                : ''
          },
          {
            title: '院区名称',
            dataIndex: 'branchHospitalName',
            searchIndex: 'branchHospitalId',
            search: (
              <ArrSelect
                options={(branchHospitalList || []).map(x => {
                  return {
                    value: x.id,
                    children: x.name
                  };
                })}
              />
            ),
            align: 'center'
          },
          {
            title: '创建时间',
            searchIndex: ['startAt', 'endAt'],
            search: <DayRangePicker valueFormat='YYYY-MM-DD' />
          },
          {
            title: '账号状态',
            searchIndex: 'status',
            search: <ArrSelect options={accountStatus} />
          },
          {
            title: '账号',
            searchIndex: 'username',
            search: true
          },
          {
            title: '部门职称',
            dataIndex: 'title',
            align: 'center'
          },
          {
            title: '姓名',
            dataIndex: 'name',
            align: 'center',
            search: true
          },
          {
            title: '联系电话',
            dataIndex: 'phone',
            align: 'center'
          },
          {
            title: '账号状态',
            dataIndex: 'status',
            align: 'center',
            render: (v, record: any) => (
              <Switch
                checkedChildren='启用'
                unCheckedChildren='禁用'
                checked={v}
                disabled={record.isHospitalDefaultAdmin} // 医院默认管理员不允许操作
                onChange={checked => {
                  if (checked) {
                    handleSubmit(() => {
                      return apis.accountStart.request({
                        accountIds: [record.id]
                      });
                    }, '启用');
                  } else {
                    handleSubmit(() => {
                      return apis.accountStop.request({
                        accountIds: [record.id]
                      });
                    }, '禁用');
                  }
                }}
              />
            )
          },
          {
            title: '创建时间',
            align: 'center',
            dataIndex: 'createdAt',
            width: 200
          },
          {
            title: '操作',
            excelRender: false,
            align: 'center',
            fixed: 'right',
            width: 260,
            render: (
              v,
              record: any // 医院默认管理员不允许操作
            ) =>
              record.isHospitalDefaultAdmin ? (
                ''
              ) : (
                <ActionsWrap max={4}>
                  <LinkButton
                    onClick={() => {
                      setCurrentAccountId(record.id);
                      setRoleVisible(true);
                      setSelectedRoleId(record.roleIds || []);
                    }}>
                    配置角色
                  </LinkButton>
                  <LinkButton
                    onClick={() => {
                      switchModalVisible({
                        ...record,
                        isEnabled: record.status
                      });
                      setBranchHospitalId(record.branchHospitalId);
                    }}>
                    编辑
                  </LinkButton>
                  <LinkButton
                    onClick={() => {
                      actionConfirm(
                        () => {
                          return apis.accountResetPwd.request({
                            id: record.id
                          });
                        },
                        '重置密码',
                        { template: '确定要重置密码吗？初始密码为：123456' }
                      );
                    }}>
                    重置密码
                  </LinkButton>
                  <LinkButton
                    onClick={() => {
                      actionConfirm(() => {
                        return apis.accountDel.request({
                          accountIds: [record.id]
                        });
                      }, '删除');
                    }}
                    style={{ color: 'red' }}>
                    删除
                  </LinkButton>
                </ActionsWrap>
              )
          }
        ]}
        pagination={paginationSetUp}
        getList={({ pagination: { current = 1, pageSize = 10 }, params }) => {
          return apis.getAccountList
            .request({
              page: current,
              size: pageSize,
              ...params
            })
            .then(data => data);
        }}
      />
      {roleVisible && (
        <Modal
          title='配置角色'
          visible={true}
          width={'800px'}
          onOk={() => {
            setRoleVisible(false);
            setCurrentAccountId(undefined);
          }}
          footer={false}
          onCancel={() => {
            setRoleVisible(false);
            setSelectedRoleId([]);
            setCurrentAccountId(undefined);
          }}>
          <Table
            size={'small'}
            bordered
            rowKey='id'
            rowSelection={{
              selectedRowKeys: selectedRoleId,
              type: 'checkbox',
              onChange: selectedRowKeys => {
                setSelectedRoleId(selectedRowKeys as number[]);
              }
            }}
            columns={[
              {
                title: '角色名称',
                dataIndex: 'name',
                align: 'center'
              },
              {
                title: '角色描述',
                dataIndex: 'intro',
                align: 'center',
                width: '70%'
              }
            ]}
            pagination={false}
            dataSource={roleList}
          />
          <ModalButtons>
            <Button
              className='modal-button'
              size='large'
              onClick={() => {
                setRoleVisible(false);
                setSelectedRoleId([]);
                setCurrentAccountId(undefined);
              }}>
              取消
            </Button>
            <Button
              size='large'
              type='primary'
              disabled={!selectedRoleId?.length}
              className='modal-button modal-button1'
              onClick={() => {
                if (
                  (currentAccountId || currentAccountId === 0) &&
                  selectedRoleId?.length
                ) {
                  handleSubmit(() =>
                    apis.accountRoleSetting
                      .request({
                        id: currentAccountId,
                        roles: selectedRoleId
                      })
                      .then(() => {
                        message.success('保存成功');
                        setSelectedRoleId([]);
                        setRoleVisible(false);
                        setCurrentAccountId(undefined);
                      })
                  );
                }
              }}>
              保存
            </Button>
          </ModalButtons>
        </Modal>
      )}
    </>
  );
};

const ModalButtons = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin-top: 30px;
  > .modal-button {
    width: 128px;
  }
  > .modal-button1 {
    margin-left: 30px;
  }
`;
