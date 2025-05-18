import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm"
import { UserRole } from "../enums/UserRole"
import { Village } from "./Village"
import { Ticket } from "./Ticket"
import { TicketComment } from "./TicketComment"
import { TicketHistory } from "./TicketHistory"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column({ unique: true })
  email: string

  @Column()
  password: string

  @Column({ nullable: true })
  contact: string

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.CITIZEN,
  })
  role: UserRole

  @ManyToOne(() => Village, { nullable: true })
  @JoinColumn({ name: "village_id" })
  village: Village

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "assigned_by_user_id" })
  assignedBy: User

  @OneToMany(
    () => User,
    (user) => user.assignedBy,
  )
  assignedUsers: User[]

  @OneToMany(
    () => Ticket,
    (ticket) => ticket.citizen,
  )
  tickets: Ticket[]

  @OneToMany(
    () => TicketComment,
    (comment) => comment.user,
  )
  comments: TicketComment[]

  @OneToMany(
    () => TicketHistory,
    (history) => history.reviewedBy,
  )
  reviewedTickets: TicketHistory[]

  @Column({ default: false })
  isVerified: boolean

  @Column({ nullable: true })
  resetPasswordToken: string

  @Column({ nullable: true })
  resetPasswordExpires: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
