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
import { Cell } from "./Cell"
import { User } from "./User"
import { Ticket } from "./Ticket"

@Entity("villages")
export class Village {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @ManyToOne(
    () => Cell,
    (cell) => cell.villages,
  )
  @JoinColumn({ name: "cell_id" })
  cell: Cell

  @OneToMany(
    () => User,
    (user) => user.village,
  )
  residents: User[]

  @OneToMany(
    () => Ticket,
    (ticket) => ticket.village,
  )
  tickets: Ticket[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
