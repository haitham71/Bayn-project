import uuid
import enum
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

# from bayn.features.identity.models import UserProfile, Project, UserRating, User
from Bayn.backend.bayn.tests.features.catalog.test_service import db
from bayn.features.project.schemas import ProjectCreate, ProjectUpdate  # RatingCreate # line 8 and 9 are ..)

# Assumed explicit imports based on your new classes
from bayn.features.project.models import Project, ProjectMembership, ProjectRoleEnum, UserProfile, User

# ── Project Business Logic # "core lifecycle"──────────────────────────────────────────────────────

async def get_or_create_project(db: AsyncSession, user_id: uuid.UUID, payload: ProjectCreate) -> Project:
    project = Project(
        title=payload.title,
        description=payload.description,
        more_info=payload.more_info,
        specialization_id=payload.specialization_id,
        industry_id=payload.industry_id,
        availability=payload.availability,
        is_hidden=payload.is_hidden,
        project_url=payload.project_url,
        images=payload.images,
    )
    db.add(project)
    await db.flush()  # Populates project.id inside the active transaction boundary

    membership = ProjectMembership(
        user_id=user_id,
        project_id=project.id,
        role=ProjectRoleEnum.OWNER
    )
    db.add(membership)
    
    await db.commit()
    await db.refresh(project)
    return project

async def update_project(db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID, payload: ProjectUpdate) -> Project:
    # Implementation for updating a project
    auth_check = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
            ProjectMembership.role == ProjectRoleEnum.OWNER
        )
    )
    if not auth_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project owners can modify this project.")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return project

async def remove_project(db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID) -> None:
    auth_check = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
            ProjectMembership.role == ProjectRoleEnum.OWNER
        )
    )
    if not auth_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project owners can delete this project.")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()

async def get_public_project_card(db: AsyncSession, project_id: uuid.UUID) -> List[Project]:
    # Query project along with its details preloaded
    result = await db.execute(select(Project).where(Project.is_hidden == False))
    project = result.scalar().all()t(Project).where(Project.is_hidden == False))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.is_hidden:
        raise HTTPException(status_code=404, detail="Project card not found")  #lines 74 vs 77: if project is nowhere to be found vs if project is hidden

    # Fetch projects
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    projects = proj_result.scalars().all() #is this line for fetch project or rating? i think it is for fetching the project

    # Calculate average rating targeting the user who owns this profile
    # rating_result = await db.execute(
        # select(func.avg(UserRating.rating_value)).where(UserRating.target_user_id == profile.user_id)
    # )
    # avg_rating = rating_result.scalar() or 0.0

# why does this part have all of those red lines underneath -_-?
    return {
     "profile_id": profile.id,
    "user_id": profile.user_id,
    "role": profile.role,    
    "bio": profile.bio,
    "city": profile.city,
    "skills": profile.skills,
    "specialization": profile.specialization,
    "is_available_for_hire": profile.is_available_for_hire,
    "show_city": profile.show_city,
    "projects": projects
    }
# rating as part of this block was here 

# ── Projects Business Logic ─────────────────────────────────────────

async def add_project(db: AsyncSession, user: User, payload: ProjectCreate) -> Project:
    profile = await get_or_create_profile(db, user.id)
    
    project = Project(
        profile_id=profile.id,
        title=payload.title,
        description=payload.description,
        project_url=str(payload.project_url) if payload.project_url else None, #change this to pictures only??
        images=payload.images,
        calendar_slots=payload.calendar_slots,  #make sure to handle this in the Project model and schema if you want to store calendar slots
    )                                           #should i add the comma in that last line??
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

# AI COMMENT: Optional: If your calendar slot model has a 'project_id' field to link them back, 
    # you can run an update query here to attach this project to those slots.: ASK LAYLA!!

async def remove_project(db: AsyncSession, user: User, project_id: uuid.UUID) -> None:
    auth_check = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
            ProjectMembership.role == ProjectRoleEnum.OWNER
        )
    )
    
    profile = await get_or_create_project(db, user.id)
    
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.profile_id == profile.id)
    )
    if not auth_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project owners can delete this project.")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    await db.delete(project)
    await db.commit()

# ── Peer Ratings Business Logic ───────────────────────────────────────────────

#async def submit_peer_rating(db: AsyncSession, rater: User, target_user_id: uuid.UUID, payload: RatingCreate) -> UserRating:
 #   if rater.id == target_user_id:
  #      raise HTTPException(status_code=400, detail="You cannot rate your own profile") #add this to errors in exceptions + jason files ar and en

    # Check if target user profile exists
#    target_profile = await db.execute(select(UserProfile).where(UserProfile.user_id == target_user_id))
 #   if not target_profile.scalar_one_or_none():
  #      raise HTTPException(status_code=404, detail="Target user profile does not exist")

    # Check for existing rating to update or handle conflict cleanly
#    existing_result = await db.execute(
 #       select(UserRating).where(UserRating.target_user_id == target_user_id, UserRating.rater_id == rater.id)
  #  )
   # existing_rating = existing_result.scalar_one_or_none()

#    if existing_rating:
 #       existing_rating.rating_value = payload.rating_value
  #      existing_rating.review_text = payload.review_text
       # rating = existing_rating
    #else:
     #   rating = UserRating(
      #      target_user_id=target_user_id,
       #     rater_id=rater.id,
        #    rating_value=payload.rating_value,
         #   review_text=payload.review_text
        #)
        #db.add(rating)
#
#    await db.commit()
 #   await db.refresh(rating)
  #  return rating

## handles the raw database interactions for fetching , updating, filtering and deleting

##import uuid
##from typing import List, Optional
##from sqlalchemy.ext.asyncio import AsyncSession
##from sqlalchemy import select
##from fastapi import HTTPException, status
##from bayn.features.identity.models import Project, UserProfile

## check this part with Layla

# ── Read All Projects (Lightweight Summary Card) ──────────────────────────────
async def get_all_project_cards(db: AsyncSession) -> List[dict]:
    # Joins Project with UserProfile to easily grab the creator's role or info if needed
    result = await db.execute(
        select(Project, UserProfile.role)
        .join(UserProfile, Project.profile_id == UserProfile.id)
    )
    rows = result.all()
    
    # Returns an optimized list containing just the essentials for a catalog view
    return [
        {
            "id": row.Project.id,
            "title": row.Project.title,
            "description": row.Project.description,
            "images": row.Project.images,
        }
        for row in rows
    ]

# ── Read One Project (Full Deep-Dive Details Page) ────────────────────────────
async def get_project_by_id(db: AsyncSession, project_id: uuid.UUID) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# ── Update Project ──────────────────────────────────────────────────────────── #is it duplicated?
async def update_project(
    db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID, payload: dict
) -> Project:
    # First, verify the profile belongs to the requesting user to enforce ownership
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=403, detail="Not authorized to edit this project")

    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.profile_id == profile.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")

    # Update only the fields provided in the request body
    for key, value in payload.items():
        if value is not None:
            setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return project

# ── Filter Projects By Attributes ─────────────────────────────────────────────
async def filter_projects(
    db: AsyncSession, 
    industry: Optional[str] = None, 
    specialization: Optional[str] = None, 
    skill: Optional[str] = None
) -> List[Project]:
    query = select(Project).join(UserProfile, Project.profile_id == UserProfile.id)

    # Dynamically inject filters based on what the frontend provides in the query params
    if industry:
        # Assumes industry is a text field or attribute on your UserProfile
        query = query.where(UserProfile.industry == industry)
    if specialization:
        query = query.where(UserProfile.specialization == specialization)
    if skill:
        # Uses SQL ANY/contains logic assuming skills are saved as a Postgres ARRAY type
        query = query.where(UserProfile.skills.any(skill))

    result = await db.execute(query)
    return result.scalars().all()