import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm"
import { User } from "./User"
import { Village } from "./Village"
import { TicketStatus } from "../enums/TicketStatus"
import { TicketPriority } from "../enums/TicketPriority"
import { TicketComment } from "./TicketComment"
import { TicketHistory } from "./TicketHistory"

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  title: string

  @Column("text")
  description: string

  @Column({
    type: "enum",
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus

  @Column({
    type: "enum",
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority

  @Column({ nullable: true })
  category: string

  @Column({ nullable: true })
  aiCategory: string

  @ManyToOne(() => User)
  @JoinColumn({ name: "citizen_id" })
  citizen: User

  @ManyToOne(() => Village)
  @JoinColumn({ name: "village_id" })
  village: Village

  @OneToMany(
    () => TicketComment,
    (comment) => comment.ticket,
  )
  comments: TicketComment[]

  @OneToMany(
    () => TicketHistory,
    (history) => history.ticket,
  )
  statusHistory: TicketHistory[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
