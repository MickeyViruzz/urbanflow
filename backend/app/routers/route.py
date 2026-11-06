from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import RouteCheckIn
from app.services.geo import GeocodeError
from app.services.routing import RoutingError, check_route

router = APIRouter(prefix="/api/route", tags=["route"])


@router.post("/check")
def route_disruption_check(
    payload: RouteCheckIn, session: Session = Depends(get_db)
) -> dict:
    try:
        return check_route(session, payload.origin, payload.destination)
    except GeocodeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RoutingError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
