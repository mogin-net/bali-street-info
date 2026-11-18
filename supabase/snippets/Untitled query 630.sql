SELECT to_regprocedure(
  'public.submit_street_report(double precision,double precision,double precision,double precision,text,boolean,boolean,text)'
);

NOTIFY pgrst, 'reload schema';