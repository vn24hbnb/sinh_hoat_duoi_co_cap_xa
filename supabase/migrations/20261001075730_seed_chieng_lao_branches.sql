insert into public.chi_bos (organization_id,name,chi_bo_number,sort_order,is_active)
select o.id,v.name,null,v.sort_order,true
from public.organizations o
cross join (values
  ('Chi bộ BXDĐ',1),
  ('Chi bộ Văn phòng ĐU',2),
  ('Chi bộ UBKT',3),
  ('Chi bộ MTTQ VN',4),
  ('Văn phòng HĐND - UBND xã',5),
  ('Chi bộ phòng kinh tế',6),
  ('Chi bộ phòng Nông nghiệp MT',7),
  ('Chi bộ phòng VH-XH',8),
  ('Chi bộ TTPVHCC',9),
  ('Trạm Y tế',10),
  ('TTDVTT',11),
  ('CA xã',12),
  ('QS xã',13)
) as v(name,sort_order)
where o.slug='chieng-lao'
on conflict (organization_id,name) do nothing;
