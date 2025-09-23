import { prisma } from '@/lib/prisma';
import { WorkstationOrderStatus } from '@prisma/client';

interface AssignOrderToWorkstationsParams {
  orderId: string;
  priority?: number;
  assignedBy?: string;
}

interface UpdateWorkstationOrderStatusParams {
  orderId: string;
  workstationId: string;
  status: WorkstationOrderStatus;
  notes?: string;
  updatedBy?: string;
}

interface GetWorkstationOrdersParams {
  workstationId: string;
  status?: WorkstationOrderStatus[];
  isVisible?: boolean;
  limit?: number;
}

export class WorkstationOrderQueueService {
  /**
   * 根据产品工艺路线自动分配订单到相关工位
   */
  async assignOrderToWorkstations(params: AssignOrderToWorkstationsParams) {
    const { orderId, priority = 0, assignedBy = 'system' } = params;

    try {
      // 获取订单及其产品工艺路线信息
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          product: {
            include: {
              productWorkstations: {
                include: {
                  workstation: {
                    select: {
                      id: true,
                      workstationId: true,
                      name: true
                    }
                  }
                },
                orderBy: {
                  sequence: 'asc' // 按工艺路线顺序排序
                }
              }
            }
          }
        }
      });

      if (!order) {
        throw new Error(`订单 ${orderId} 不存在`);
      }

      if (!order.product) {
        throw new Error(`订单 ${order.orderNumber} 没有关联的产品`);
      }

      // 获取产品的工艺路线配置
      const productWorkstations = order.product.productWorkstations;

      if (productWorkstations.length === 0) {
        return [];
      }

      // 检查是否已经分配过
      const existingAssignments = await prisma.workstationOrderQueue.findMany({
        where: { orderId }
      });

      if (existingAssignments.length > 0) {
        return existingAssignments;
      }

      // 根据产品工艺路线分配到相关工位
      const assignments = [];
      for (const productWorkstation of productWorkstations) {
        const assignment = await prisma.workstationOrderQueue.create({
          data: {
            orderId,
            workstationId: productWorkstation.workstation.id,
            status: 'PENDING',
            priority: priority || order.priority,
            sequence: productWorkstation.sequence, // 使用工艺路线的序号
            isVisible: true,
            notes: `基于产品工艺路线自动分配 - ${assignedBy}`
          },
          include: {
            workstation: {
              select: {
                workstationId: true,
                name: true
              }
            }
          }
        });
        assignments.push(assignment);
      }



      return assignments;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 更新工位订单状态
   */
  async updateWorkstationOrderStatus(params: UpdateWorkstationOrderStatusParams) {
    const { orderId, workstationId, status, notes, updatedBy = 'system' } = params;

    try {
      const existing = await prisma.workstationOrderQueue.findUnique({
        where: {
          orderId_workstationId: { orderId, workstationId }
        },
        include: {
          order: { select: { orderNumber: true } },
          workstation: { select: { workstationId: true, name: true } }
        }
      });

      if (!existing) {
        throw new Error(`工位订单记录不存在: 订单 ${orderId}, 工位 ${workstationId}`);
      }

      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (notes) {
        updateData.notes = notes;
      }

      // 设置时间戳
      if (status === 'IN_PROGRESS' && !existing.startedAt) {
        updateData.startedAt = new Date();
      } else if (status === 'COMPLETED' || status === 'CANCELLED') {
        updateData.completedAt = new Date();
        if (status === 'COMPLETED') {
          // 获取工位信息
          const workstation = await prisma.workstation.findUnique({
            where: { id: workstationId },
            select: { isOrderCompleteStation: true, name: true }
          });

          // 1. 当前工位完成订单后，该订单从当前工位消失
          updateData.isVisible = false;
          updateData.notes = `订单已在工位 ${workstation?.name || existing.workstation.name} 完成`;

          if (workstation?.isOrderCompleteStation) {
            // 2. 如果这是一个"关闭订单"的工位，关闭整个订单并隐藏所有其他工位的相同订单
            
            // 更新订单全局状态为已完成
            await prisma.order.update({
              where: { id: orderId },
              data: { 
                status: 'COMPLETED',
                completedAt: new Date()
              }
            });
            
            // 隐藏所有其他工位的相同订单（包括未开始和进行中的）
            await prisma.workstationOrderQueue.updateMany({
              where: {
                orderId,
                workstationId: { not: workstationId },
                status: { in: ['PENDING', 'IN_PROGRESS'] }
              },
              data: {
                isVisible: false,
                notes: `订单已在关闭工位 ${workstation?.name} 完成，整个订单已关闭`
              }
            });
            

          } else {

          }
        }
      }

      const updated = await prisma.workstationOrderQueue.update({
        where: {
          orderId_workstationId: { orderId, workstationId }
        },
        data: updateData,
        include: {
          order: { select: { orderNumber: true } },
          workstation: { select: { workstationId: true, name: true } }
        }
      });


      return updated;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取工位的订单列表
   */
  async getWorkstationOrders(params: GetWorkstationOrdersParams) {
    const { workstationId, status, isVisible = true, limit = 50 } = params;

    try {
      const where: any = {
        workstationId,
        isVisible
      };

      if (status && status.length > 0) {
        where.status = { in: status };
      }

      // 简化查询以避免潜在的关联问题
      const orders = await prisma.workstationOrderQueue.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              productionNumber: true,
              quantity: true,
              completedQuantity: true,
              priority: true,
              status: true,
              productId: true,
              createdAt: true,
              plannedDate: true
            }
          },
          workstation: {
            select: {
              workstationId: true,
              name: true
            }
          }
        },
        orderBy: [
          { priority: 'asc' },
          { sequence: 'asc' },
          { assignedAt: 'asc' }
        ],
        take: limit
      });

      // 分别获取产品信息以避免嵌套查询问题
      const productIds = [...new Set(orders.map(o => o.order?.productId).filter(Boolean))];
      
      let products = new Map();
      if (productIds.length > 0) {
        const productList = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            productCode: true,
            name: true
          }
        });
        productList.forEach(p => products.set(p.id, p));
      }

      // 重组数据，添加产品信息
      const ordersWithProducts = orders.map(order => ({
        ...order,
        order: {
          ...order.order,
          product: order.order?.productId ? products.get(order.order.productId) : null
        }
      }));

      return ordersWithProducts;
    } catch (error) {
      console.error('getWorkstationOrders error:', error);
      throw error;
    }
  }

  /**
   * 获取订单在所有工位的分配状态
   */
  async getOrderAllocationStatus(orderId: string) {
    try {
      const allocations = await prisma.workstationOrderQueue.findMany({
        where: { orderId },
        include: {
          workstation: {
            select: {
              workstationId: true,
              name: true,
              isOrderCompleteStation: true
            }
          },
          order: {
            select: {
              orderNumber: true,
              productionNumber: true,
              status: true
            }
          }
        },
        orderBy: {
          assignedAt: 'asc'
        }
      });

      return allocations;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 手动分配订单到指定工位
   */
  async manualAssignOrderToWorkstation(orderId: string, workstationId: string, assignedBy: string) {
    try {
      // 检查是否已存在
      const existing = await prisma.workstationOrderQueue.findUnique({
        where: {
          orderId_workstationId: { orderId, workstationId }
        }
      });

      if (existing) {
        // 如果已存在但被隐藏，重新显示
        if (!existing.isVisible) {
          return await prisma.workstationOrderQueue.update({
            where: { id: existing.id },
            data: {
              isVisible: true,
              notes: `手动重新分配 - ${assignedBy}`
            },
            include: {
              order: { select: { orderNumber: true } },
              workstation: { select: { workstationId: true, name: true } }
            }
          });
        } else {
          throw new Error('订单已分配到该工位');
        }
      }

      // 创建新分配
      const assignment = await prisma.workstationOrderQueue.create({
        data: {
          orderId,
          workstationId,
          status: 'PENDING',
          isVisible: true,
          notes: `手动分配 - ${assignedBy}`
        },
        include: {
          order: { select: { orderNumber: true } },
          workstation: { select: { workstationId: true, name: true } }
        }
      });


      return assignment;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取系统订单分配概览
   */
  async getSystemOverview() {
    try {
      // 获取各工位的订单统计
      const workstationStats = await prisma.workstation.findMany({
        select: {
          id: true,
          workstationId: true,
          name: true,
          isOrderCompleteStation: true,
          workstationOrderQueues: {
            where: { isVisible: true },
            select: {
              status: true,
              order: {
                select: {
                  orderNumber: true,
                  status: true
                }
              }
            }
          }
        }
      });

      // 统计各状态的订单数量
      const overview = workstationStats.map(ws => ({
        workstation: {
          id: ws.id,
          workstationId: ws.workstationId,
          name: ws.name,
          isOrderCompleteStation: ws.isOrderCompleteStation
        },
        statistics: {
          pending: ws.workstationOrderQueues.filter(q => q.status === 'PENDING').length,
          inProgress: ws.workstationOrderQueues.filter(q => q.status === 'IN_PROGRESS').length,
          completed: ws.workstationOrderQueues.filter(q => q.status === 'COMPLETED').length,
          total: ws.workstationOrderQueues.length
        },
        orders: ws.workstationOrderQueues.map(q => ({
          orderNumber: q.order.orderNumber,
          status: q.status,
          globalStatus: q.order.status
        }))
      }));

      return overview;
    } catch (error) {
      throw error;
    }
  }
}

export const workstationOrderQueueService = new WorkstationOrderQueueService();