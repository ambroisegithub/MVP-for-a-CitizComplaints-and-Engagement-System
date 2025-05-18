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
import { Province } from "./Province"
import { Sector } from "./Sector"

@Entity("districts")
export class District {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @ManyToOne(
    () => Province,
    (province) => province.districts,
  )
  @JoinColumn({ name: "province_id" })
  province: Province

  @OneToMany(
    () => Sector,
    (sector) => sector.district,
  )
  sectors: Sector[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
